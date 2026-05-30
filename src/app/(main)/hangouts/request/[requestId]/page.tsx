import { redirect } from 'next/navigation';

interface Props {
  params: Promise<{ requestId: string }>;
}

export default async function HangoutRequestEditRedirectPage({ params }: Props) {
  const { requestId } = await params;
  redirect(`/tsudoi/request/${requestId}`);
}

