import { JoinClient } from "./join-client";

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawToken = params.token;
  const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;

  if (!token) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#151a17] px-5 text-[#f4f0e7]">
        <section className="max-w-lg text-center">
          <h1 className="font-display text-4xl">Pairing token missing</h1>
          <p className="mt-4 leading-7 text-white/68">
            Ask the presenter to create a new visitor QR from DestinationOS.
          </p>
        </section>
      </main>
    );
  }

  return <JoinClient token={token} />;
}
