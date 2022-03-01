import { faExternalLinkAlt } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import React from "react";
import { Link } from "../Link";

export const Suggestion = ({ errorMessage }: { errorMessage?: string }) => {
  let advice: string | null = null;
  let documentationUrl: string | null = null;
  if (errorMessage?.startsWith(`Failed to resolve import `)) {
    advice = "Show me how to configure aliases";
    documentationUrl = "https://previewjs.com/docs/config/aliases";
  } else if (
    errorMessage?.includes("Failed to execute 'createElement'") &&
    errorMessage?.includes(".svg")
  ) {
    advice = "Help me set up SVGR";
    documentationUrl = "https://previewjs.com/docs/config/svgr";
  } else if (errorMessage?.includes("Could not resolve")) {
    const match = errorMessage.match(
      /Could not resolve "((@[a-zA-Z0-9-]+\/[a-zA-Z0-9-]+)|[a-zA-Z0-9-]+)/
    );
    if (match) {
      advice = `Perhaps you need to install ${match[1]}?`;
    } else {
      advice = "Perhaps you need to install a peer dependency?";
    }
  }
  return advice ? (
    <div id="suggestion">
      {documentationUrl ? (
        <Link id="suggestion-link" href={documentationUrl}>
          <FontAwesomeIcon icon={faExternalLinkAlt} /> {advice}
        </Link>
      ) : (
        <div id="suggestion-text">{advice}</div>
      )}
    </div>
  ) : null;
};
