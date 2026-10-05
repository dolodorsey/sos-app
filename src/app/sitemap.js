export const dynamic = 'force-static';

export default function sitemap(){
  const base='https://thesuperherosonstandby.com';
  const paths=['/','/hero/apply/','/superheros/','/why-superheros/','/about-superheros-on-standby/','/superheros-network/','/history/','/brand/','/press/','/media-kit/'];
  return paths.map((path)=>({
    url:base+path,
    changeFrequency:path==='/'||path==='/hero/apply/'?'weekly':'monthly',
    priority:path==='/'?1:path==='/hero/apply/'?.9:path==='/superheros/'?.95:.75
  }));
}
