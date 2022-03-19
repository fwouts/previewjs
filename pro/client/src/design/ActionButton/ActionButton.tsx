import { Link } from "@previewjs/app/client/src/design/Link";
import clsx from "clsx";
import React from "react";

export const ActionButton = ({
  type = "default",
  children,
  ...rest
}: {
  children: string;
  type?: "default" | "cta" | "danger";
} & ({ onClick(): void } | { href: string } | { submit: true })) => {
  const className = clsx([
    "mx-2 py-2 px-4 rounded border-2 cursor-pointer",
    type === "default" &&
      "border-transparent text-gray-700 hover:text-gray-800",
    type === "cta" && "border-green-700 text-green-700 hover:text-green-800",
    type === "danger" &&
      "border-orange-500 text-orange-500 hover:text-orange-600",
  ]);
  if ("onClick" in rest) {
    return (
      <button className={className} onClick={rest.onClick}>
        {children}
      </button>
    );
  } else if ("submit" in rest) {
    return <input className={className} type="submit" value={children} />;
  } else {
    return (
      <Link className={className} href={rest.href}>
        {children}
      </Link>
    );
  }
};
