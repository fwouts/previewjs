import styled from "@emotion/styled";
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
    <Container id="suggestion">
      {documentationUrl ? (
        <SuggestionLink id="suggestion-link" href={documentationUrl}>
          <FontAwesomeIcon icon={faExternalLinkAlt} /> {advice}
        </SuggestionLink>
      ) : (
        <SuggestionText id="suggestion-text">{advice}</SuggestionText>
      )}
    </Container>
  ) : null;
};

const Container = styled.div`
  display: inline-block;
  font-size: 0.8rem;
  border-radius: 8px;
  padding: 8px;
  background: hsl(0, 40%, 85%);
  color: hsl(0, 80%, 20%);
  margin-top: 8px;
`;

const SuggestionLink = styled(Link)`
  text-decoration: none;
  color: hsl(45, 70%, 10%);

  &:hover {
    color: hsl(45, 70%, 10%);
  }
`;

const SuggestionText = styled.div`
  color: hsl(45, 100%, 10%);
`;
