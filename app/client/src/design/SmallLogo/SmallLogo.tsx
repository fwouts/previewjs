import React from "react";
import { ReactComponent as LogoSvg } from "../../../../../assets/logo.svg";
import { Link } from "../Link";

export const SmallLogo = (props: {
  href: string;
  label: string;
  title?: string;
}) => {
  return (
    <Link
      className="inline-flex items-center bg-blue-100 text-blue-900 ml-2 pl-0.5 pr-1.5 py-0.5 text-sm font-semibold rounded whitespace-nowrap"
      target="_blank"
      href={props.href}
      title={props.title}
    >
      <LogoSvg className="h-6 w-6 mr-1" />
      {props.label}
    </Link>
  );
};
