const PATHS: Record<string, string> = {
  projects: 'M3 6h7l2 2h9v11H3z',
  import: 'M12 3v12m0 0l-5-5m5 5l5-5M4 19h16',
  create: 'M4 5h16v12H4zM8 13l3-3 3 3 2-2 3 3M9 9h.01M12 21l3-3H9z',
  character: 'M12 4a2.5 2.5 0 110 5 2.5 2.5 0 010-5zM7 21l2-7-3-3 4-1h4l4 1-3 3 2 7',
  viewer: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12L4 7.5',
  animate: 'M5 4l14 8-14 8z',
  weapons: 'M4 20l9-9m0 0l6-6 1 1-6 6m-1-1l2 2M6 14l4 4',
  export: 'M12 15V3m0 0L7 8m5-5l5 5M4 15v5h16v-5',
};

export function NavIcon({ name }: { name: string }) {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={PATHS[name] ?? ''} />
    </svg>
  );
}
