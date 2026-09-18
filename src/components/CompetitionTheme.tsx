import { useEffect } from "react";

import { competitionThemeAssetUrl } from "@/lib/data";
import type { CompetitionTheme } from "@/lib/db-types";

export const DEFAULT_COMPETITION_THEME: CompetitionTheme = {
  id: "builtin-lkk",
  name: "LKK",
  favicon_path: "/lkk/favicon.ico",
  background_image_path: "/lkk/lkk_logo.svg",
  created_at: "",
  updated_at: "",
};

/**
 * Applies organiser branding to the document without changing the global
 * fallback design tokens used by admin and unbranded pages.
 */
export function useCompetitionTheme(theme: CompetitionTheme | null | undefined) {
  useEffect(() => {
    const backgroundUrl = competitionThemeAssetUrl(theme?.background_image_path);
    const faviconUrl = competitionThemeAssetUrl(theme?.favicon_path);
    const body = document.body;
    const previous = {
      backgroundImage: body.style.backgroundImage,
      backgroundSize: body.style.backgroundSize,
      backgroundPosition: body.style.backgroundPosition,
      backgroundAttachment: body.style.backgroundAttachment,
      backgroundBlendMode: body.style.backgroundBlendMode,
    };

    if (backgroundUrl) {
      body.style.backgroundImage =
        `linear-gradient(rgba(10, 13, 22, 0.72), rgba(10, 13, 22, 0.86)), ` +
        `url("${backgroundUrl}")`;
      body.style.backgroundSize = "cover";
      body.style.backgroundPosition = "center";
      body.style.backgroundAttachment = "fixed";
      body.style.backgroundBlendMode = "normal";
    }
    document.documentElement.dataset["competitionTheme"] = theme ? "custom" : "default";

    let favicon: HTMLLinkElement | null = null;
    if (faviconUrl) {
      favicon = document.createElement("link");
      favicon.rel = "icon";
      favicon.href = faviconUrl;
      favicon.dataset["competitionTheme"] = "custom";
      document.head.appendChild(favicon);
    }

    return () => {
      body.style.backgroundImage = previous.backgroundImage;
      body.style.backgroundSize = previous.backgroundSize;
      body.style.backgroundPosition = previous.backgroundPosition;
      body.style.backgroundAttachment = previous.backgroundAttachment;
      body.style.backgroundBlendMode = previous.backgroundBlendMode;
      delete document.documentElement.dataset["competitionTheme"];
      favicon?.remove();
    };
  }, [theme?.background_image_path, theme?.favicon_path, theme]);
}
