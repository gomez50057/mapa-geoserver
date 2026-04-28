"use client";

import { usePathname } from "next/navigation";
import Footer from "./Footer";
import { NavbarPrincipal, NavbarSecundaria } from "./Navbar";
import styles from "./AppChrome.module.css";

export default function AppChrome({ children }) {
  const pathname = usePathname();
  const isMapPage = pathname === "/mapa";

  if (isMapPage) return children;

  return (
    <>
      {pathname === "/" ? <NavbarPrincipal /> : <NavbarSecundaria />}
      <div className={pathname === "/" ? styles.homeContent : styles.content}>{children}</div>
      <Footer />
    </>
  );
}
