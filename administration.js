import { catalog } from "./catalog.js";

export const actions = ["view", "create", "edit", "delete"];
export const permissionGroups = [
  ["Dashboard", "apps", ["dashboard"]],
  ["People & admission", "users", ["students", "teachers"]],
  [
    "Academics",
    "cap",
    [
      "classes",
      "subjects",
      "timetable",
      "homework",
      "submissions",
      "sessions",
      "leaves",
    ],
  ],
  ["Attendance", "calendar", ["attendance"]],
  ["Examinations", "certificate", ["exams", "results"]],
  ["Finance", "wallet", ["fees", "payments"]],
  ["Library", "library", ["library", "loans"]],
  [
    "Transport & campus",
    "bus",
    ["transport", "fleet", "studentTransport", "hostel"],
  ],
  [
    "Communication & workspace",
    "chat",
    [
      "workspace",
      "announcements",
      ...Object.entries(catalog)
        .filter(([, value]) => value.personal)
        .map(([key]) => key),
    ],
  ],
  [
    "Administration",
    "shield",
    ["users", "roles", "deletionRequests", "schools"],
  ],
].map(([name, icon, keys]) => ({
  name,
  icon,
  keys: keys.filter(
    (key) =>
      Object.hasOwn(catalog, key) ||
      [
        "dashboard",
        "workspace",
        "users",
        "roles",
        "deletionRequests",
        "schools",
      ].includes(key),
  ),
}));
export const resources = [
  ...new Set(permissionGroups.flatMap((group) => group.keys)),
];
export const permissionKeys = resources.flatMap((key) =>
  actions.map((action) => key + "." + action),
);
export const resourceLabel = (key) =>
  ({
    dashboard: "Dashboard",
    workspace: "Workspace apps",
    users: "User accounts",
    roles: "Roles & permissions",
    deletionRequests: "Deletion requests",
    schools: "Schools",
  })[key] ||
  catalog[key]?.label ||
  key;
const academic = [
  "dashboard",
  "students",
  "teachers",
  "classes",
  "subjects",
  "timetable",
  "homework",
  "submissions",
  "sessions",
  "leaves",
  "attendance",
  "exams",
  "results",
  "announcements",
  "workspace",
];
const makeRole = (id, name, baseRole, icon, tone, keys = resources) => ({
  _id: "system-" + id,
  name,
  baseRole,
  icon,
  tone,
  system: true,
  status: "Active",
  description:
    id === "admin"
      ? "Full, unrestricted access to every module, setting and user across the institution."
      : name +
        " access with the appropriate school records and workspace tools.",
  permissions: [
    ...new Set(
      keys.concat(
        baseRole !== "admin"
          ? [
              "schools",
              ...Object.entries(catalog)
                .filter(([, value]) => value.personal)
                .map(([key]) => key),
            ]
          : [],
      ),
    ),
  ].flatMap((key) =>
    (baseRole === "admin" ||
    key === "workspace" ||
    catalog[key]?.personal ||
    ([
      "homework",
      "attendance",
      "results",
      "submissions",
      "leaves",
      "sessions",
      "announcements",
    ].includes(key) &&
      baseRole === "teacher")
      ? actions
      : ["view"]
    ).map((action) => key + "." + action),
  ),
});
export const systemRoles = [
  makeRole("admin", "Administrator", "admin", "crown", "blue"),
  makeRole("teacher", "Teacher", "teacher", "teacher", "green", academic),
  makeRole(
    "student",
    "Student",
    "student",
    "cap",
    "purple",
    academic.concat([
      "fees",
      "payments",
      "library",
      "loans",
      "transport",
      "studentTransport",
    ]),
  ),
  makeRole(
    "parent",
    "Parent",
    "parent",
    "family",
    "cyan",
    academic.concat([
      "fees",
      "payments",
      "library",
      "loans",
      "transport",
      "studentTransport",
    ]),
  ),
  makeRole("accountant", "Accountant", "admin", "calculator", "gold", [
    "dashboard",
    "students",
    "fees",
    "payments",
    "workspace",
  ]),
  makeRole("librarian", "Librarian", "admin", "library", "cyan", [
    "dashboard",
    "students",
    "library",
    "loans",
    "workspace",
  ]),
  makeRole("receptionist", "Receptionist", "admin", "profile", "purple", [
    "dashboard",
    "students",
    "teachers",
    "workspace",
  ]),
  makeRole("transport", "Transport Staff", "admin", "bus", "blue", [
    "dashboard",
    "students",
    "transport",
    "fleet",
    "studentTransport",
    "workspace",
  ]),
];
export function allowed(user, resource, action = "view") {
  return !user.access || user.access.includes(resource + "." + action);
}
export function validatePermissions(value) {
  return (
    Array.isArray(value) &&
    value.length <= permissionKeys.length &&
    value.every((key) => permissionKeys.includes(key))
  );
}
export function transitionAllowed(from, to) {
  return (
    {
      Pending: ["Under Review", "Rejected", "Cancelled"],
      "Under Review": ["Manager Approved", "Rejected", "Cancelled"],
      "Manager Approved": ["Approved", "Rejected", "Cancelled"],
      Approved: ["Scheduled", "Cancelled"],
      Scheduled: ["Completed", "Cancelled"],
    }[from] || []
  ).includes(to);
}
