import { Link } from "@previewjs/app/client/src/design/Link";
import clsx from "clsx";
import React from "react";

export const ActionButton = ({
  type = "default",
  children,
  ...rest
}: {
  children: React.ReactNode;
  type?: "default" | "info" | "cta" | "danger";
} & ({ onClick(): void } | { href: string } | { submit: true })) => {
  const className = clsx([
    "py-1 px-2 sm:px-4 font-medium border-2 border-transparent rounded cursor-pointer",
    type === "default" && "text-gray-200 hover:bg-gray-700 hover:text-white",
    type === "info" && "text-sky-500 hover:bg-sky-900 hover:text-white",
    type === "cta" &&
      "bg-green-700 text-green-100 hover:bg-green-600 hover:text-white",
    type === "danger" && "text-orange-400 hover:bg-orange-700 hover:text-white",
  ]);
  if ("onClick" in rest) {
    return (
      <button type="button" className={className} onClick={rest.onClick}>
        {children}
      </button>
    );
  } else if ("submit" in rest) {
    if (typeof children !== "string") {
      throw new Error(`Unsupported non-string children for submit button`);
    }
    return <input className={className} type="submit" value={children} />;
  } else {
    return (
      <Link className={className} href={rest.href}>
        {children}
      </Link>
    );
  }
};
