import assert from "node:assert/strict";
import { test } from "node:test";
import { once } from "node:events";
import express from "express";
import { administrationRoutes } from "../server/administration.js";
import { loadAccess } from "../server/auth.js";
import {
  allowed,
  validatePermissions,
  systemRoles,
  transitionAllowed,
} from "../administration.js";

const adminId = "a".repeat(24),
  otherId = "b".repeat(24),
  roleId = "c".repeat(24),
  requestId = "d".repeat(24);
async function fixture(run) {
  const people = [
    {
      _id: adminId,
      name: "Owner",
      email: "owner@example.com",
      role: "admin",
      status: "Active",
      studentIds: [],
    },
    {
      _id: otherId,
      name: "Teacher",
      email: "teacher@example.com",
      role: "teacher",
      status: "Active",
      studentIds: [],
    },
  ];
  const audits = [],
    revoked = [],
    custom = [],
    requests = [];
  const User = {
    findById: async (id) => people.find((u) => u._id === id),
    create: async (fields) => {
      const row = {
        _id: "e".repeat(24),
        ...fields,
        toObject() {
          return { ...this };
        },
      };
      people.push(row);
      return row;
    },
    updateOne: async (scope, update) =>
      Object.assign(
        people.find((u) => u._id === scope._id),
        update.$set,
      ),
    exists: async (query) => people.some((u) => u.roleId === query.roleId),
    distinct: async () => [],
    deleteOne: async (scope) =>
      people.splice(
        people.findIndex((u) => u._id === scope._id),
        1,
      ),
  };
  const Role = {
    findById: async (id) => custom.find((r) => r._id === id),
    create: async (value) => {
      const row = { _id: roleId, ...value, save: async () => {} };
      custom.push(row);
      return row;
    },
    findByIdAndDelete: async (id) => custom.find((r) => r._id === id),
  };
  const Request = {
    db: { transaction: async (callback) => callback({}) },
    findOne: (query) => ({
      session: async () =>
        requests.find(
          (r) =>
            r._id === query._id &&
            r.status === query.status &&
            r.__v === query.__v,
        ),
    }),
    findById: async (id) => requests.find((r) => r._id === id),
    create: async (value) => {
      const row = {
        _id: requestId,
        __v: 0,
        ...value,
        status: "Pending",
        save: async () => {},
      };
      requests.push(row);
      return row;
    },
  };
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user =
      req.get("x-actor") === "teacher"
        ? people[1]
        : {
            ...people[0],
            ...(req.get("x-actor") === "limited"
              ? {
                  access: [
                    "users.create",
                    "users.edit",
                    "roles.create",
                    "roles.edit",
                    "deletionRequests.edit",
                  ],
                }
              : {}),
          };
    next();
  });
  app.use(
    "/admin",
    administrationRoutes({
      User,
      Session: { deleteMany: async (q) => revoked.push(q) },
      models: { students: { countDocuments: async () => 0 } },
      Role,
      Request,
      Audit: { create: async (row) => audits.push(row) },
    }),
  );
  app.use((e, _req, res, _next) =>
    res.status(e.status || 500).json({ message: e.message }),
  );
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const call = async (path, method = "POST", body = {}, actor) => {
    const response = await fetch(
      "http://127.0.0.1:" + server.address().port + "/admin" + path,
      {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(actor ? { "x-actor": actor } : {}),
        },
        body: method === "GET" ? undefined : JSON.stringify(body),
      },
    );
    const data = response.status === 204 ? null : await response.json();
    return { status: response.status, data };
  };
  try {
    await run({ call, people, custom, requests, audits, revoked });
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}
test("inactive accounts and missing permission keys fail closed", async () => {
  for (const status of ["Pending", "Inactive", "Blocked"])
    assert.equal(await loadAccess({ status, role: "admin" }), false);
  assert.equal(await loadAccess(null), false);
  const person = {
    status: "Active",
    role: "admin",
    roleId: "system-accountant",
  };
  assert.equal(await loadAccess(person), true);
  assert.equal(allowed(person, "fees", "edit"), true);
  assert.equal(allowed(person, "users", "create"), false);
  assert.equal(
    await loadAccess({
      status: "Active",
      role: "teacher",
      roleId: "system-admin",
    }),
    false,
  );
  assert.equal(validatePermissions(["not-a-module.delete"]), false);
  assert.equal(validatePermissions(["users.edit", "students.view"]), true);
});
test("non-admins cannot access administration and scoped admins cannot grant more access", async () =>
  fixture(async ({ call }) => {
    assert.equal((await call("/users", "GET", {}, "teacher")).status, 403);
    assert.equal(
      (
        await call(
          "/users",
          "POST",
          {
            name: "Escalation",
            email: "test@example.com",
            password: "Long-Password-123",
            roleId: "system-admin",
          },
          "limited",
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await call(
          "/roles",
          "POST",
          {
            name: "Escalation",
            baseRole: "admin",
            permissions: ["users.delete"],
          },
          "limited",
        )
      ).status,
      403,
    );
  }));
test("account creation validates linked students and keeps password hashes out of responses", async () =>
  fixture(async ({ call, audits }) => {
    const body = {
      name: "New Teacher",
      email: "NEW@example.com",
      password: "A-unique-long-password",
      roleId: "system-teacher",
      studentIds: [],
    };
    assert.equal(
      (await call("/users", "POST", { ...body, password: "short" })).status,
      400,
    );
    assert.equal(
      (
        await call("/users", "POST", {
          ...body,
          avatar: "https://example.com/portrait.svg",
        })
      ).status,
      400,
    );
    assert.equal(
      (await call("/users", "POST", { ...body, roleId: "system-student" }))
        .status,
      400,
    );
    const result = await call("/users", "POST", body);
    assert.equal(result.status, 201);
    assert.equal(result.data.email, "new@example.com");
    assert.equal(result.data.role, "teacher");
    assert.equal(result.data.passwordHash, undefined);
    assert.equal(audits.length, 1);
  }));
test("access changes revoke sessions and current administrators cannot disable themselves", async () =>
  fixture(async ({ call, people, revoked }) => {
    assert.equal(
      (
        await call("/users/" + adminId + "/status", "PATCH", {
          status: "Blocked",
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await call("/users/" + otherId + "/status", "PATCH", {
          status: "Blocked",
        })
      ).status,
      204,
    );
    assert.equal(people[1].status, "Blocked");
    assert.deepEqual(revoked, [{ userId: otherId }]);
  }));
test("system roles are protected and assigned custom roles cannot be removed", async () =>
  fixture(async ({ call, people, custom }) => {
    assert.equal(
      (
        await call("/roles/system-admin", "PUT", {
          permissions: [],
          status: "Active",
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await call("/roles", "POST", {
          name: "Invalid",
          baseRole: "admin",
          permissions: ["invalid"],
        })
      ).status,
      400,
    );
    const created = await call("/roles", "POST", {
      name: "Science Viewer",
      baseRole: "teacher",
      permissions: ["students.view"],
    });
    assert.equal(created.status, 201);
    people[1].roleId = custom[0]._id;
    assert.equal((await call("/roles/" + roleId, "DELETE")).status, 409);
  }));
test("deletion review does not remove accounts and enforces transitions and waiting period", async () =>
  fixture(async ({ call, people, requests }) => {
    assert.equal(
      (await call("/requests", "POST", { userId: adminId, reason: "Test" }))
        .status,
      409,
    );
    const created = await call("/requests", "POST", {
      userId: otherId,
      reason: "Duplicate account",
    });
    assert.equal(created.status, 201);
    assert.equal(
      (await call("/requests/" + requestId, "PATCH", { status: "Completed" }))
        .status,
      409,
    );
    assert.equal(
      (
        await call("/requests/" + requestId, "PATCH", {
          status: "Under Review",
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await call("/requests/" + requestId, "PATCH", {
          status: "Manager Approved",
        })
      ).status,
      200,
    );
    assert.equal(
      (await call("/requests/" + requestId, "PATCH", { status: "Approved" }))
        .status,
      200,
    );
    assert.equal(people.length, 2);
    assert.equal(
      (await call("/requests/" + requestId, "PATCH", { status: "Scheduled" }))
        .status,
      200,
    );
    assert.ok(new Date(requests[0].executeAfter) > new Date());
    assert.equal(
      (
        await call("/requests/" + requestId, "PATCH", {
          status: "Completed",
          confirmEmail: people[1].email,
        })
      ).status,
      409,
    );
    assert.equal(people.length, 2);
    assert.equal(
      (await call("/requests/" + requestId, "PATCH", { status: "Cancelled" }))
        .status,
      200,
    );
    assert.equal(
      (await call("/requests/" + requestId, "PATCH", { status: "Approved" }))
        .status,
      409,
    );
  }));
test("terminal deletion states cannot be reopened and predefined roles have valid permissions", () => {
  for (const state of ["Completed", "Cancelled", "Rejected"])
    for (const next of ["Pending", "Approved", "Completed"])
      assert.equal(transitionAllowed(state, next), false);
  for (const role of systemRoles)
    assert.equal(validatePermissions(role.permissions), true, role.name);
});
test("custom role updates persist permissions and revoke assigned sessions", async () =>
  fixture(async ({ call, custom, revoked }) => {
    await call("/roles", "POST", {
      name: "Viewer",
      baseRole: "teacher",
      permissions: ["students.view"],
    });
    const result = await call("/roles/" + roleId, "PUT", {
      name: "Academic Viewer",
      description: "Read academic records",
      permissions: ["students.view", "classes.view"],
      status: "Active",
    });
    assert.equal(result.status, 200);
    assert.equal(custom[0].name, "Academic Viewer");
    assert.deepEqual(custom[0].permissions, ["students.view", "classes.view"]);
    assert.equal(revoked.length, 1);
  }));
test("final account removal requires elapsed review time and exact email confirmation", async () =>
  fixture(async ({ call, requests, people, revoked }) => {
    await call("/requests", "POST", {
      userId: otherId,
      reason: "Duplicate account",
    });
    await call("/requests/" + requestId, "PATCH", { status: "Under Review" });
    await call("/requests/" + requestId, "PATCH", {
      status: "Manager Approved",
    });
    await call("/requests/" + requestId, "PATCH", { status: "Approved" });
    await call("/requests/" + requestId, "PATCH", { status: "Scheduled" });
    requests[0].executeAfter = new Date(Date.now() - 1000);
    assert.equal(
      (
        await call("/requests/" + requestId, "PATCH", {
          status: "Completed",
          confirmEmail: "wrong@example.com",
        })
      ).status,
      400,
    );
    assert.equal(people.length, 2);
    assert.equal(
      (
        await call("/requests/" + requestId, "PATCH", {
          status: "Completed",
          confirmEmail: "teacher@example.com",
        })
      ).status,
      200,
    );
    assert.equal(people.length, 1);
    assert.equal(people[0]._id, adminId);
    assert.equal(requests[0].status, "Completed");
    assert.deepEqual(revoked, [{ userId: otherId }]);
  }));
