import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { I18nProvider, useI18n } from "../lib/i18n/provider";
import { LanguageSelector } from "../components/strata/language-selector";
import { EmailForm } from "../components/auth/email-form";
import { Library } from "../components/strata/library";
function Controls() {
  const { locale } = useI18n();
  return (
    <>
      <LanguageSelector />
      <output id="active-locale">{locale}</output>
      <EmailForm initialConfigured={true} />
    </>
  );
}
const root = createRoot(document.getElementById("root")!);
Object.assign(window, {
  IS_REACT_ACT_ENVIRONMENT: true,
  strataTest: {
    act,
    mount: () =>
      act(async () => {
        root.render(
          <I18nProvider initialLocale="pt-BR">
            <Controls />
          </I18nProvider>,
        );
      }),
    mountLibrary: () =>
      act(async () => {
        root.render(
          <I18nProvider initialLocale="pt-BR">
            <Library />
          </I18nProvider>,
        );
      }),
    unmount: () => act(() => root.unmount()),
  },
});
