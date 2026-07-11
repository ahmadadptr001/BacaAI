import { Fragment } from "react";
import ChapterProse from "./ChapterProse";
import { splitIntoParts } from "@/lib/chapter";

/**
 * Renders a chapter as a webtoon-style sequence: when it has multiple panel
 * images, the text is split into that many ordered parts and each image sits
 * above its matching part (image i ↔ part i, kept in sync with generation via
 * the shared splitIntoParts). With 0 or 1 image it falls back to a single
 * banner + full prose. The decision point is passed as `children` so it renders
 * inside the final padded section.
 */
export default function ChapterBody({
  chapterNumber,
  totalChapters,
  heading,
  text,
  images,
  children,
}: {
  chapterNumber: number;
  totalChapters: number;
  heading: string;
  text: string;
  images: string[];
  children?: React.ReactNode;
}) {
  const parts = images.length > 1 ? splitIntoParts(text, images.length) : [text];
  const lastIndex = parts.length - 1;

  return (
    <>
      {parts.map((part, i) => {
        const img = images[i];
        const isFirst = i === 0;
        const isLast = i === lastIndex;
        return (
          <Fragment key={i}>
            {img && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={img}
                alt={`${heading} — panel ${i + 1}`}
                className="h-72 w-full object-cover sm:h-96"
              />
            )}
            <div
              className={`px-6 sm:px-8 ${isFirst ? "pt-6 sm:pt-8" : "pt-6"} ${
                isLast ? "pb-6 sm:pb-8" : ""
              }`}
            >
              {isFirst && (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-500">
                    Bab {chapterNumber} dari {totalChapters}
                  </p>
                  <h1 className="mt-1 text-2xl font-extrabold">{heading}</h1>
                </>
              )}
              <ChapterProse text={part} />
              {isLast && children}
            </div>
          </Fragment>
        );
      })}
    </>
  );
}
