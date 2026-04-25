"use client";

import { memo, useEffect, useState } from "react";

function fmt(d: Date) {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export const LiveClock = memo(function LiveClock() {
  const [now, setNow] = useState<string | null>(null);

  useEffect(() => {
    setNow(fmt(new Date()));
    const id = setInterval(() => setNow(fmt(new Date())), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="clock mono">
      обн <b>{now ?? "--:--:--"}</b>
    </span>
  );
});
