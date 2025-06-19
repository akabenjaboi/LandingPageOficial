import { useRef, useState, useEffect } from "react";

export default function useInView(options = {}) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new window.IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      options
    );
    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [options]);

  return [ref, inView];
}