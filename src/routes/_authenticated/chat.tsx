import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({
    meta: [
      { title: "المحادثة — EZRA" },
      {
        name: "description",
        content: "Chat with EZRA: share thoughts, photos and documents, study dentistry together.",
      },
      { property: "og:title", content: "المحادثة — EZRA" },
      {
        property: "og:description",
        content: "Chat with EZRA: share thoughts, photos and documents, study dentistry together.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <Outlet />,
});