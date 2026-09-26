import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

/**
 * Short-URL landing page. QR labels encode `${origin}/s/<value>`; when
 * scanned by an external camera app the browser opens this route. We
 * simply forward to the full Scan page which does the real lookup.
 * ProtectedRoute already ensures the user is signed in first.
 */
export function QrShortRedirectPage() {
  const { value } = useParams<{ value: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    const q = new URLSearchParams();
    if (value) q.set('value', value);
    navigate(`/scan?${q.toString()}`, { replace: true });
  }, [value, navigate]);

  return (
    <div className="mx-auto max-w-md px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
      Redirecting to scan…
    </div>
  );
}
