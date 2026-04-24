export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ overflow: "auto" }}>
      {children}
    </div>
  );
}
