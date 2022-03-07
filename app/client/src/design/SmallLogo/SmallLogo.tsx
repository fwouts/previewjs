import { faSpinner } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import clsx from "clsx";
import React from "react";
import { ReactComponent as LogoSvg } from "../../../../../assets/logo.svg";
import { Link } from "../Link";

export const SmallLogo = (props: {
  href: string;
  loading?: boolean;
  label?: string;
}) => {
  return (
    <Link
      className="inline-flex items-center whitespace-nowrap text-blue-100 ml-2"
      target="_blank"
      href={props.href}
    >
      <LogoSvg className="h-6 w-6 mr-2" />
      {props.loading && (
        <FontAwesomeIcon
          className={clsx(["animate-spin"], props.label && ["mr-2"])}
          icon={faSpinner}
        />
      )}
      {props.label}
    </Link>
  );
};
