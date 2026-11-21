import type { ReactNode } from "react";
import { PortalFooter } from "./PortalFooter";
import { PortalHeader } from "./PortalHeader";

type PublicInfoLayoutProps = {
  className?: string;
  kicker: string;
  title: string;
  lead: string;
  tone?: "blue" | "lime" | "coral";
  children: ReactNode;
};

export function PublicInfoLayout({ kicker, title, lead, tone = "blue", className, children }: PublicInfoLayoutProps) {
  return (
    <main className={`public-info-page public-info-${tone}${className ? ` ${className}` : ""}`}>
      <PortalHeader />
      <section className="public-page-hero">
        <div className="public-page-hero-inner">
          <p className="eyebrow">{kicker}</p>
          <h1>{title}</h1>
          <p>{lead}</p>
        </div>
      </section>
      <div className="public-info-content">{children}</div>
      <PortalFooter />
    </main>
  );
}
