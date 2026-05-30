import { redirect } from 'next/navigation';

interface Props {
  params: Promise<{ requestId: string }>;
}

export default async function HangoutReplyRedirectPage({ params }: Props) {
  const { requestId } = await params;
  redirect(`/tsudoi/reply/${requestId}`);
}

