import { css } from "@emotion/react";
import styled from "@emotion/styled";
import { faCheckCircle, faFan } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Link } from "@previewjs/app/client/src/components";
import assertNever from "assert-never";
import { observer } from "mobx-react-lite";
import React, { useCallback, useMemo } from "react";
import { AppState } from "../state/AppState";
import { LicenseModalState } from "./LicenseModalState";

export const LicenseModal = observer(({ state }: { state: AppState }) => {
  const licenseState = useMemo(() => {
    return new LicenseModalState(state);
  }, [state]);
  const onClose = useCallback(() => {
    state.toggleProModal();
  }, [state]);
  return (
    <ModalOverlay onClick={onClose}>
      <ModalContent onClick={(e) => e.stopPropagation()}>
        <ModalTitle>Preview.js Pro</ModalTitle>
        <ModalBody>
          {(() => {
            const screen = licenseState.screen;
            if (screen.loading) {
              return (
                <CenteredContainer>
                  <Icon icon={faFan} spin />
                </CenteredContainer>
              );
            }
            switch (screen.kind) {
              case "welcome":
                return (
                  <>
                    <ModalText
                      dangerouslySetInnerHTML={{
                        __html: screen.config.bodyHtml,
                      }}
                    />
                    <ModalRow>
                      <ModalLink
                        $style="cta"
                        href="https://previewjs.com/upgrade"
                      >
                        {screen.config.buttons.cta}
                      </ModalLink>
                      <ModalButton
                        onClick={() => licenseState.switchToEnterKey()}
                      >
                        {screen.config.buttons.enter}
                      </ModalButton>
                    </ModalRow>
                  </>
                );
              case "enter-key":
                if (screen.success) {
                  return (
                    <CenteredContainer>
                      <Icon icon={faCheckCircle} />
                    </CenteredContainer>
                  );
                }
                return (
                  <form
                    onSubmit={(e) => {
                      screen.submit();
                      e.preventDefault();
                    }}
                  >
                    <label htmlFor="license-key-input">
                      Enter your license key:
                    </label>
                    <ModalInput
                      id="license-key-input"
                      autoFocus
                      autoComplete="off"
                      required
                      placeholder="XXXX-XXXX-XXXX-XXXX-XXXX"
                      value={screen.licenseKey}
                      onChange={(event) =>
                        screen.updateLicenseKey(event.target.value)
                      }
                    />
                    {screen.error && <Error>{screen.error}</Error>}
                    <ModalRow>
                      <ModalButton
                        onClick={() => licenseState.switchToWelcome()}
                      >
                        Go back
                      </ModalButton>
                      <ModalSubmit type="submit" value="Confirm" $style="cta" />
                    </ModalRow>
                  </form>
                );
              case "revoke-token":
                return (
                  <>
                    <p>There are too many devices using this license key.</p>
                    <p>Pick unused devices to revoke access:</p>
                    <ModalList>
                      {screen.existingTokens.map((t) => (
                        <li key={t.lastActiveTimestamp}>
                          <label>
                            <input
                              type="checkbox"
                              onChange={(e) =>
                                screen.toggleTokenForDeletion(
                                  t,
                                  e.target.checked
                                )
                              }
                            />
                            {t.name} (last used on{" "}
                            {new Date(t.lastActiveTimestamp).toDateString()})
                          </label>
                        </li>
                      ))}
                    </ModalList>
                    {screen.error && <Error>{screen.error}</Error>}
                    <ModalRow>
                      <ModalButton
                        $style="cta"
                        onClick={() => screen.confirm()}
                      >
                        Confirm
                      </ModalButton>
                    </ModalRow>
                  </>
                );
              case "license-state":
                return (
                  <>
                    <p>
                      License key:
                      <br />
                      <b>{screen.licenseState.maskedKey}</b>
                    </p>
                    <p>
                      Status:
                      <br />
                      <b>
                        {screen.licenseState.checked.valid
                          ? "Valid"
                          : screen.licenseState.checked.reason}
                      </b>{" "}
                      (last checked{" "}
                      {new Date(
                        screen.licenseState.checked.timestamp
                      ).toLocaleString()}
                      )
                    </p>
                    <ModalRow>
                      <ModalButton onClick={onClose}>Close</ModalButton>
                      <ModalButton
                        $style="cta"
                        onClick={() => screen.refresh()}
                      >
                        Refresh
                      </ModalButton>
                      <ModalButton
                        $style="danger"
                        onClick={() => screen.unlink()}
                      >
                        Unlink this device
                      </ModalButton>
                    </ModalRow>
                  </>
                );
              default:
                throw assertNever(screen);
            }
          })()}
        </ModalBody>
      </ModalContent>
    </ModalOverlay>
  );
});

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  background: hsla(213, 20%, 20%, 50%);
  z-index: 100;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  backdrop-filter: blur(2px);
`;

const ModalContent = styled.div`
  background: hsl(213, 100%, 100%);
  border-radius: 6px;
  box-shadow: 0 4px 8px 0 rgba(0, 0, 0, 0.2);
  margin: 16px;
`;

const ModalTitle = styled.h3`
  font-weight: 400;
  color: hsl(213, 60%, 20%);
  font-weight: 800;
  text-transform: uppercase;
  font-size: 0.9rem;
  margin: 12px 16px;
`;

const ModalBody = styled.div`
  margin: 16px;

  p {
    margin-bottom: 16px;
  }
`;

const ModalText = styled.div``;

const CenteredContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48px 96px;
`;

const Icon = styled(FontAwesomeIcon)`
  color: hsl(213, 60%, 60%);
  font-size: 4rem;
`;

const Error = styled.p`
  background: hsl(0, 50%, 80%);
  color: hsl(0, 70%, 30%);
  padding: 8px;
  border-radius: 8px;
  margin: 8px 0;
`;

const ModalInput = styled.input`
  display: block;
  border-radius: 4px;
  border: 2px solid transparent;
  background: hsl(213, 20%, 90%);
  margin: 8px 0 16px 0;
  padding: 8px;
  outline: none;
  font-family: source-code-pro, Menlo, Monaco, Consolas, "Courier New",
    monospace;
  font-weight: 600;
  font-size: 1rem;
  width: 30rem;

  &:focus {
    border: 2px solid hsl(213, 40%, 60%);
  }
`;

const ModalRow = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: center;
`;

const ModalList = styled.ul`
  list-style: none;
  margin: 0;
  margin-bottom: 16px;
  padding: 0;

  > li {
    margin: 0;
  }
`;

const ButtonStyle = ({ $style }: ButtonStyleProps) => css`
  ${$style === "cta"
    ? css`
        border: 1.5px solid hsl(160, 60%, 35%);
        color: hsl(160, 60%, 35%);

        &:hover {
          color: hsl(160, 70%, 20%);
          background: hsl(160, 70%, 80%);
        }
      `
    : $style === "danger"
    ? css`
        border: 1.5px solid hsl(25, 60%, 55%);
        color: hsl(25, 60%, 55%);

        &:hover {
          color: hsl(25, 70%, 30%);
          background: hsl(25, 70%, 80%);
        }
      `
    : css`
        border: none;
        color: hsl(213, 30%, 40%);

        &:hover {
          color: hsl(213, 60%, 20%);
        }
      `}

  background: none;
  border-radius: 4px;
  font-weight: 600;
  cursor: pointer;
  font-size: 1rem;
  margin: 0 8px;
  padding: 8px 16px;
  text-decoration: none;
`;

interface ButtonStyleProps {
  $style?: "cta" | "danger";
}

const ModalButton = styled.a<ButtonStyleProps>(ButtonStyle);

const ModalSubmit = styled.input<ButtonStyleProps>(ButtonStyle);

const ModalLink = styled(Link)<ButtonStyleProps>(ButtonStyle);
