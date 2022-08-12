import React from "react";
import { Link } from "../Link";

export const SmallLogo = (props: {
  href: string;
  label: string;
  title?: string;
}) => {
  return (
    <Link
      className="inline-flex items-center text-gray-50 ml-2 pl-0.5 pr-1.5 py-0.5 text-sm font-semibold rounded whitespace-nowrap"
      target="_blank"
      href={props.href}
      title={props.title}
    >
      <svg
        width="512px"
        height="512px"
        viewBox="0 0 512 512"
        xmlns="http://www.w3.org/2000/svg"
        xmlnsXlink="http://www.w3.org/1999/xlink"
        className="h-6 w-6 mr-1"
      >
        <defs>
          <path
            d="M178.998,315 L179,439 L105,439 L105,46 L240,46 L240,46.004 L241.724203,46.0180192 C314.980631,47.2057605 374,106.960524 374,180.5 C374,254.281294 314.591849,314.187071 241.001081,314.991796 L241,315 L178.998,315 Z M240.5,109 C200.459356,109 168,141.459356 168,181.5 C168,221.540644 200.459356,254 240.5,254 C280.540644,254 313,221.540644 313,181.5 C313,141.459356 280.540644,109 240.5,109 Z"
            id="path-1"
          ></path>
          <filter
            x="-9.3%"
            y="-10.2%"
            width="137.2%"
            height="122.9%"
            filterUnits="objectBoundingBox"
            id="filter-2"
          >
            <feOffset
              dx="30"
              dy="5"
              in="SourceAlpha"
              result="shadowOffsetOuter1"
            ></feOffset>
            <feGaussianBlur
              stdDeviation="10"
              in="shadowOffsetOuter1"
              result="shadowBlurOuter1"
            ></feGaussianBlur>
            <feColorMatrix
              values="0 0 0 0 0   0 0 0 0 0   0 0 0 0 0  0 0 0 0.253425045 0"
              type="matrix"
              in="shadowBlurOuter1"
            ></feColorMatrix>
          </filter>
        </defs>
        <g
          id="logo"
          stroke="none"
          strokeWidth="1"
          fill="none"
          fillRule="evenodd"
        >
          <g id="Group" transform="translate(17.000000, 17.000000)">
            <rect
              id="Rectangle"
              fill="#3B83F6"
              x="4"
              y="4"
              width="470"
              height="470"
              rx="69"
            ></rect>
            <g id="Oval">
              <use
                fill="black"
                fillOpacity="1"
                filter="url(#filter-2)"
                xlinkHref="#path-1"
              ></use>
              <use fill="#FFFFFF" fillRule="evenodd" xlinkHref="#path-1"></use>
            </g>
          </g>
        </g>
      </svg>
      {props.label}
    </Link>
  );
};
