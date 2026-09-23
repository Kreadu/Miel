/**
 * Inline blocking script — runs before first paint to apply the saved theme
 * (or the OS preference) and prevent FOUC.
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
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
