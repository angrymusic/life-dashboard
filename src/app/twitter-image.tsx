import { ImageResponse } from "next/og";
import { SITE_DESCRIPTION, SITE_NAME } from "./seo";

export const size = {
  width: 1200,
  height: 675,
};
export const alt = `${SITE_NAME} Twitter image`;
export const contentType = "image/png";

export default function TwitterImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          padding: "52px",
          background:
            "linear-gradient(140deg, #111827 0%, #1d4ed8 42%, #14b8a6 100%)",
          color: "#f8fafc",
          fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%",
            height: "100%",
            borderRadius: "24px",
            border: "2px solid rgba(248,250,252,0.2)",
            background: "rgba(2, 6, 23, 0.4)",
            padding: "42px",
          }}
        >
          <span
            style={{
              fontSize: "24px",
              fontWeight: 700,
              letterSpacing: "0.03em",
              color: "rgba(224,242,254,0.95)",
            }}
          >
            PLAN | TRACK | SHARE
          </span>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <h1
              style={{
                margin: 0,
                fontSize: "78px",
                lineHeight: 1.06,
                fontWeight: 800,
                letterSpacing: "-0.03em",
              }}
            >
              {SITE_NAME}
            </h1>
            <p
              style={{
                margin: 0,
                fontSize: "30px",
                lineHeight: 1.28,
                color: "rgba(241,245,249,0.94)",
                maxWidth: "1020px",
              }}
            >
              {SITE_DESCRIPTION}
            </p>
          </div>
        </div>
      </div>
    ),
    size
  );
}
