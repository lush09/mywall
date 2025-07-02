"use client";
import { useEffect, useState, useRef } from "react";
import { supabase } from "../../lib/supabaseClient";

interface Post {
  id: string;
  author_id: string;
  message: string;
  created_at: string;
}

export default function Wall() {
  const [message, setMessage] = useState("");
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetchPosts(0);
    // Subscribe to new posts
    const channel = supabase
      .channel("public:posts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "posts" },
        (payload) => {
          setPosts((prev) => [payload.new as Post, ...prev]);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchPosts(pageNum: number) {
    setLoading(true);
    const pageSize = 10;
    const from = pageNum * pageSize;
    const to = from + pageSize - 1;
    let { data, error } = await supabase
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false })
      .range(from, to);
    if (error) setError("Failed to load posts");
    if (data && data.length > 0) {
      setPosts((prev) => pageNum === 0 ? data as Post[] : [...prev, ...data as Post[]]);
      setHasMore(data.length === pageSize);
    } else {
      setHasMore(false);
    }
    setLoading(false);
  }

  function handleLoadMore() {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchPosts(nextPage);
  }

  async function handleShare(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim() || message.length > 280) return;
    const { error } = await supabase.from("posts").insert([
      { author_id: "anonymous", message },
    ]);
    if (!error) setMessage("");
    else setError("Failed to post!");
    textareaRef.current?.focus();
  }

  return (
    <div className="min-h-screen bg-white p-3 font-sans flex flex-col">
      {/* Header */}
      <header className="w-full bg-blue-500 py-3 px-6 flex rounded-t-lg items-center">
        <span className="text-white text-xl font-bold tracking-wide">wall</span>
      </header>
      <main className="flex flex-1 flex-col md:flex-row min-h-0">
        {/* Sidebar */}
        <aside className="w-full md:w-80 flex-shrink-0 py-6 px-8 flex flex-col items-center bg-white">
          <img
            src="/toga.jpg"
            alt="Profile Image"
            className="w-[100%] max-w-xs aspect-square rounded-md object-cover mb-4 mx-auto"
          />
          <div className="w-full flex flex-col items-start">
            <div className="text-2xl font-bold mb-1 text-gray-800 text-left">Shigeru Houshi</div>
            <div className="text-gray-500 mb-7 font-semibold text-left">wall</div>
            <button className="mb-4 px-2 py-3 border font-bold border-gray-300 rounded bg-gray-100 text-gray-700 text-sm text-left">Information</button>
          </div>
          <div className="w-full text-left text-sm text-gray-700">
            <div className="mb-2">
              <span className="font-semibold text-gray-800">Networks</span>
              <br />Columban College Inc.
            </div>
            <div>
              <span className="font-semibold text-gray-800">Current City</span>
              <br />Manila, Philippines
            </div>
          </div>
        </aside>
        {/* Separator */}
        <div className="hidden md:block w-px bg-gray-300 my-8" />
        {/* Main Wall */}
        <section className="flex-1 flex flex-col gap-6 px-2 md:px-8 py-8 min-w-0">
          {/* Wall Input */}
          <form onSubmit={handleShare} className="flex flex-col gap-2">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={e => setMessage(e.target.value)}
              maxLength={280}
              placeholder="What's on your mind?"
              rows={3}
              className="w-full border-2 border-dashed border-gray-300 rounded-sm p-3 text-base resize-none focus:outline-none focus:border-blue-400 bg-gray-50 placeholder:text-gray-600 text-gray-700"
            />
            <div className="flex items-center justify-between">
              <span className={`text-sm ${message.length > 280 ? 'text-red-500' : 'text-gray-400'}`}>{280 - message.length} characters remaining</span>
              <button
                type="submit"
                disabled={!message.trim() || message.length > 280}
                className="bg-blue-500 text-white font-semibold px-6 py-2 rounded-lg disabled:opacity-40"
              >
                Share
              </button>
            </div>
          </form>
          {/* Feed */}
          <div className="flex-1 flex flex-col gap-3 min-w-0 max-h-[60vh] overflow-y-auto px-3">
            {/* Posts Feed */}
            {loading ? (
              <div className="text-gray-800">Loading posts...</div>
            ) : posts.length === 0 ? (
              <div className="text-gray-800">No posts yet. Be the first!</div>
            ) : (
              posts.map(post => (
                <div key={post.id} className="border-b last:border-b-0 border-gray-200 pb-3 mb-3 last:mb-0 last:pb-0">
                  <div className="flex items-center justify-between w-full">
                    <span className="font-bold text-gray-800">Shigeru Houshi</span>
                    <span className="text-xs text-gray-800 font-normal ml-2 whitespace-nowrap">{formatRelativeTime(post.created_at)}</span>
                  </div>
                  <div className="text-base mt-1 mb-1 whitespace-pre-line text-gray-800">{post.message}</div>
                </div>
              ))
            )}
            {error && <div className="text-red-500 mt-2">{error}</div>}
            {hasMore && !loading && (
              <button
                onClick={handleLoadMore}
                className="mt-2 px-4 py-2 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 text-sm mx-auto"
              >
                Load more
              </button>
            )}
          </div>
        </section>
      </main>
    </div>
  );

  // --- Helpers ---
  function formatRelativeTime(dateString: string) {
    const now = new Date();
    const date = new Date(dateString);
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diff < 60) return 'now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h';
    return Math.floor(diff / 86400) + 'd';
  }
}
