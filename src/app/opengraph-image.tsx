import { ImageResponse } from "next/og";
import { SITE_DESCRIPTION, SITE_NAME } from "./seo";

export const size = {
  width: 1200,
  height: 630,
};
export const alt = `${SITE_NAME} Open Graph image`;
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          padding: "56px",
          background:
            "linear-gradient(130deg, #0f172a 0%, #115e59 52%, #f59e0b 100%)",
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
            borderRadius: "28px",
            border: "2px solid rgba(248,250,252,0.22)",
            background: "rgba(2, 6, 23, 0.42)",
            padding: "44px",
          }}
        >
          <div style={{ display: "flex", gap: "14px" }}>
            <span
              style={{
                fontSize: "22px",
                fontWeight: 700,
                letterSpacing: "0.02em",
                borderRadius: "999px",
                border: "1px solid rgba(248,250,252,0.36)",
                padding: "10px 18px",
              }}
            >
              for Life
            </span>
            <span
              style={{
                fontSize: "22px",
                fontWeight: 700,
                letterSpacing: "0.02em",
                borderRadius: "999px",
                border: "1px solid rgba(248,250,252,0.36)",
                padding: "10px 18px",
              }}
            >
              Shared dashboard
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <h1
              style={{
                margin: 0,
                fontSize: "82px",
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
                fontSize: "31px",
                lineHeight: 1.28,
                maxWidth: "980px",
                color: "rgba(241,245,249,0.95)",
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
