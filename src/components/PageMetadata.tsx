import { Helmet } from "react-helmet-async";
import { useLocation } from "react-router-dom";
import { pageSeo } from "@/lib/seo";

export function PageMetadata() {
  const { pathname } = useLocation();
  const page = pageSeo(pathname);
  return <Helmet>
    <title>{page.title}</title>
    <meta name="description" content={page.description} />
    <meta name="robots" content={page.indexable ? "index,follow" : "noindex,nofollow"} />
    <meta property="og:title" content={page.title} />
    <meta property="og:description" content={page.description} />
    <meta name="twitter:title" content={page.title} />
    <meta name="twitter:description" content={page.description} />
    {page.canonical && <link rel="canonical" href={page.canonical} />}
    {page.canonical && <meta property="og:url" content={page.canonical} />}
  </Helmet>;
}