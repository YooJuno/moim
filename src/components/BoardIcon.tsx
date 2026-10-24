import { forwardRef } from 'react';
import type { LucideProps } from 'lucide-react';

export const BoardIcon=forwardRef<SVGSVGElement,LucideProps>(function BoardIcon({size=24,strokeWidth=1.7,color='currentColor',...props},ref){
 return <svg ref={ref} xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
  <circle cx="12" cy="2.7" r="1.2"/>
  <path d="m11.1 3.6-4.7 4.8m6.5-4.8 4.7 4.8"/>
  <rect x="2.5" y="8.4" width="19" height="13.2" rx="1.2"/>
  <path d="M4.7 10.6h14.6v8.8H4.7z"/>
  <path d="M9.5 12.5h7.4m-7.4 2.4h7.4m-7.4 2.4h7.4"/>
  <circle cx="7.1" cy="12.5" r=".45"/><circle cx="7.1" cy="14.9" r=".45"/><circle cx="7.1" cy="17.3" r=".45"/>
 </svg>;
});
