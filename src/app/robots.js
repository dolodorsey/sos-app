export const dynamic = 'force-static';

export default function robots(){
  return {
    rules:{userAgent:'*',allow:'/',disallow:['/ops/','/auth/']},
    sitemap:'https://thesuperherosonstandby.com/sitemap.xml',
    host:'https://thesuperherosonstandby.com'
  };
}
