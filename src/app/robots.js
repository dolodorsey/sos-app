export const dynamic = 'force-static';

export default function robots(){
  return {
    rules:{userAgent:'*',allow:'/',disallow:['/app/','/hero/','/ops/','/track/','/login/','/request-roadside-help/','/download/']},
    sitemap:'https://thesuperherosonstandby.com/sitemap.xml',
    host:'https://thesuperherosonstandby.com'
  };
}
