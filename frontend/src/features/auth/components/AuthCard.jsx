/**
 * Plain wrapper card — the "custom UI" shell every auth screen sits inside.
 * Used by AuthLayout.jsx around LoginForm / SignupForm.
 */
function AuthCard({ title, subtitle, children }) {
  return (
    <div className="w-full rounded-3xl border border-[#e3e9e5] bg-white p-5 shadow-[0_20px_70px_rgba(31,51,42,0.12)] sm:p-8">
      <h1 className="text-center text-2xl font-extrabold tracking-tight text-pine sm:text-3xl">{title}</h1>
      {subtitle && <p className="mt-2 text-center text-sm leading-6 text-text-secondary">{subtitle}</p>}
      <div className="mt-6">{children}</div>
    </div>
  );
}

export default AuthCard;
