import Script from "next/script";

/**
 * Inline blocking script — runs before first paint to apply the saved theme
 * (or the OS preference) and prevent FOUC. `next/script` con `beforeInteractive` (y no un
 * `<script>` de React) para que React no avise al re-renderizar en el cliente: un `<script>`
 * dentro de un componente nunca se ejecuta ahí.
 */
export function ThemeScript() {
  const script = `
(function(){
  try{
    var t=localStorage.getItem('theme');
    var d=t==='dark'||(!t&&matchMedia('(prefers-color-scheme:dark)').matches);
    document.documentElement.classList.toggle('dark',d);
  }catch(e){}
})();
`;
  return (
    // App Router: Next documenta beforeInteractive en el layout raíz (este componente solo se usa
    // ahí); la regla de lint es del Pages Router (pages/_document).
    // eslint-disable-next-line @next/next/no-before-interactive-script-outside-document
    <Script id="theme-script" strategy="beforeInteractive">
      {script}
    </Script>
  );
}
