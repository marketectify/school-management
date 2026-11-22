import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./icons.jsx";

export const labelRole = (role) =>
  ({
    admin: "Administrator",
    teacher: "Teacher",
    student: "Student",
    parent: "Parent",
  })[role] || role;
export const shortId = (row, prefix = "U") =>
  prefix +
  "-" +
  String(row._id || row.id || "")
    .slice(-6)
    .toUpperCase();
export const dateText = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";
export const timeText = (value) =>
  value
    ? new Date(value).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Never signed in";
export function Btn({
  icon,
  children,
  primary = false,
  className = "",
  ...props
}) {
  return (
    <button
      type="button"
      className={(primary ? "primary " : "") + className}
      {...props}
    >
      {icon && <Icon name={icon} />} {children}
    </button>
  );
}
export function IconBtn({ icon, label, ...props }) {
  return (
    <Btn
      className="am-icon-btn"
      icon={icon}
      title={label}
      aria-label={label}
      {...props}
    />
  );
}
export function Badge({ children, tone = "" }) {
  return (
    <span
      className={
        "am-badge am-" +
        (tone ||
          {
            Active: "green",
            Approved: "green",
            Pending: "gold",
            "Under Review": "purple",
            Scheduled: "blue",
            Completed: "cyan",
            Rejected: "red",
            Blocked: "red",
            Inactive: "gray",
            Cancelled: "gray",
          }[children] ||
          "blue")
      }
    >
      <i />
      {children}
    </span>
  );
}
export function Person({ row, subtitle }) {
  return (
    <div className="am-person">
      <span
        className={
          "am-avatar am-" +
          ({
            admin: "blue",
            teacher: "green",
            student: "purple",
            parent: "gold",
          }[row.role] || "cyan")
        }
      >
        {row.avatar ? (
          <img src={row.avatar} alt="" />
        ) : (
          row.name
            ?.split(" ")
            .slice(0, 2)
            .map((s) => s[0])
            .join("")
        )}
        <i className={row.status === "Active" ? "online" : ""} />
      </span>
      <span>
        <strong>{row.name}</strong>
        <small>{subtitle || row.email}</small>
      </span>
    </div>
  );
}
export function PageHeading({ title, children }) {
  return (
    <div className="am-page-heading">
      <div>
        <h1>{title}</h1>
        <p>
          Dashboard <b>/</b> Administration <b>/</b>{" "}
          <span>{title === "User Management" ? "Users" : title}</span>
        </p>
      </div>
      <div className="am-actions">{children}</div>
    </div>
  );
}
export function Stats({ items }) {
  return (
    <div className="am-stats">
      {items.map(([label, value, icon, tone, note]) => (
        <article key={label}>
          <span className={"am-stat-icon am-" + tone}>
            <Icon name={icon} />
            <i />
          </span>
          <div>
            <strong>{value}</strong>
            <span>{label}</span>
            <small className={"am-tag am-" + tone}>{note}</small>
          </div>
        </article>
      ))}
    </div>
  );
}
export function Modal({ title, children, close, wide = false }) {
  const panel = useRef(null),
    previous = useRef(document.activeElement);
  useEffect(() => {
    const el = panel.current;
    el?.querySelector("input,select,textarea,button")?.focus();
    function key(e) {
      if (e.key === "Escape") close();
      if (e.key === "Tab") {
        const list = [
          ...el.querySelectorAll("button,input,select,textarea,a[href]"),
        ].filter((n) => !n.disabled && !n.hidden);
        if (e.shiftKey && document.activeElement === list[0]) {
          e.preventDefault();
          list.at(-1)?.focus();
        } else if (!e.shiftKey && document.activeElement === list.at(-1)) {
          e.preventDefault();
          list[0]?.focus();
        }
      }
    }
    document.addEventListener("keydown", key);
    const prior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = prior;
      previous.current?.focus();
    };
  }, []);
  return createPortal(
    <div
      className="am-overlay"
      onMouseDown={(e) => e.target === e.currentTarget && close()}
    >
      <section
        className={"am-dialog" + (wide ? " wide" : "")}
        role="dialog"
        aria-modal="true"
        aria-labelledby="am-dialog-title"
        ref={panel}
      >
        <div className="am-dialog-head">
          <h2 id="am-dialog-title">{title}</h2>
          <IconBtn icon="close" label="Close dialog" onClick={close} />
        </div>
        {children}
      </section>
    </div>,
    document.querySelector(".layout") || document.body,
  );
}
export function Menu({ label, icon, children }) {
  const [open, setOpen] = useState(false),
    [point, setPoint] = useState({}),
    trigger = useRef(),
    panel = useRef();
  useEffect(() => {
    if (!open) return;
    const dismiss = (e) => {
      if (
        !trigger.current?.contains(e.target) &&
        !panel.current?.contains(e.target)
      )
        setOpen(false);
    };
    const key = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    const scroll = () => setOpen(false);
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", key);
    window.addEventListener("resize", scroll);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", key);
      window.removeEventListener("resize", scroll);
    };
  }, [open]);
  return (
    <span className="am-menu">
      <button
        type="button"
        ref={trigger}
        aria-label={label || "More actions"}
        aria-expanded={open}
        onClick={() => {
          const r = trigger.current.getBoundingClientRect();
          setPoint({
            top: Math.min(r.bottom + 7, innerHeight - 310),
            left: Math.min(Math.max(8, r.left), innerWidth - 252),
          });
          setOpen((v) => !v);
        }}
      >
        <Icon name={icon} />
        {label}
        {label && <Icon name="chevron" />}
      </button>
      {open &&
        createPortal(
          <div
            className="am-popmenu"
            ref={panel}
            style={point}
            onClick={(e) => {
              if (e.target.closest("button")) setOpen(false);
            }}
          >
            {children}
          </div>,
          document.querySelector(".layout") || document.body,
        )}
    </span>
  );
}
export function Search({
  value,
  onChange,
  placeholder = "Search name, ID, email, role…",
}) {
  return (
    <div className="am-search">
      <Icon name="search" />
      <input
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <kbd>⌘K</kbd>
    </div>
  );
}
export function Empty({ loading, error }) {
  return (
    <div className="am-empty" role={error ? "alert" : "status"}>
      <Icon name={error ? "alert" : loading ? "refresh" : "users"} />
      <h3>
        {error
          ? "Unable to load records"
          : loading
            ? "Loading records…"
            : "No matching records"}
      </h3>
      <p>
        {error || (!loading && "Try another filter, or add your first record.")}
      </p>
    </div>
  );
}
export function download(name, rows, type = "csv") {
  const clean = (value) => {
    const s = String(value ?? "");
    return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
  };
  const content =
    type === "json"
      ? JSON.stringify(rows, null, 2)
      : "\ufeff" +
        [Object.keys(rows[0] || {}), ...rows.map(Object.values)]
          .map((row) =>
            row
              .map((v) => '"' + clean(v).replaceAll('"', '""') + '"')
              .join(","),
          )
          .join("\r\n");
  const url = URL.createObjectURL(
    new Blob([content], {
      type: type === "json" ? "application/json" : "text/csv;charset=utf-8",
    }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name + "." + type;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function Pager({ total, page, setPage, size, setSize }) {
  const pages = Math.max(1, Math.ceil(total / size));
  return (
    <div className="am-pagination">
      <span>
        Showing{" "}
        <strong>
          {total ? Math.min((page - 1) * size + 1, total) : 0}–
          {Math.min(page * size, total)}
        </strong>{" "}
        of <strong>{total}</strong> records
      </span>
      <div>
        <label>
          Rows:{" "}
          <select
            aria-label="Rows per page"
            value={size}
            onChange={(e) => {
              setSize(Number(e.target.value));
              setPage(1);
            }}
          >
            {[10, 25, 50].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <IconBtn
          icon="back"
          label="Previous page"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
        />
        {Array.from({ length: Math.min(5, pages) }, (_, i) => i + 1).map(
          (n) => (
            <Btn
              key={n}
              primary={page === n}
              aria-current={page === n ? "page" : undefined}
              onClick={() => setPage(n)}
            >
              {n}
            </Btn>
          ),
        )}
        <IconBtn
          icon="next"
          label="Next page"
          disabled={page >= pages}
          onClick={() => setPage(page + 1)}
        />
      </div>
    </div>
  );
}
