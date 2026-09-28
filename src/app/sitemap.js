export const dynamic = 'force-static';

export default function sitemap(){
  const base='https://thesuperherosonstandby.com';
  const paths=['/','/superheros/','/why-superheros/','/about-superheros-on-standby/','/superheros-network/','/history/','/brand/','/press/','/media-kit/'];
  return paths.map((path)=>({url:base+path,changeFrequency:path==='/'?'weekly':'monthly',priority:path==='/'?1:path==='/superheros/'?.95:.75}));
}
