/**
 * Plain wrapper card — the "custom UI" shell every auth screen sits inside.
 * Used by AuthLayout.jsx around LoginForm / SignupForm.
 */
function AuthCard({ title, subtitle, children }) {
  return (
    <div className="w-full max-w-sm bg-white border border-gray rounded-2xl shadow-sm p-8">
      <h1 className="text-2xl font-bold text-pine text-center">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-pine/60 text-center">{subtitle}</p>}
      <div className="mt-6">{children}</div>
    </div>
  );
}

export default AuthCard;