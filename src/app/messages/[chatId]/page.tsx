import ClientPage from './ClientPage';
export function generateStaticParams() { return []; }
export default function Page(props: any) { return <ClientPage {...props} />; }
