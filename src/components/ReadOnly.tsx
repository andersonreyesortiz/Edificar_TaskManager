/** Desactiva todos los controles de su contenido cuando la persona no tiene permiso de edición. */
export function ReadOnly({ on, children }: { on: boolean; children: React.ReactNode }) {
  if (!on) return <>{children}</>;
  return (
    <fieldset disabled className="contents [&_button]:cursor-default [&_input]:cursor-default">
      {children}
    </fieldset>
  );
}
