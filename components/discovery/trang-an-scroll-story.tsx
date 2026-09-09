"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useReducedMotion } from "@/components/shared/use-reduced-motion";
import styles from "./trang-an-scroll-story.module.css";

export type TrangAnStoryBeat = {
  id: string;
  image: string;
  alt: string;
  eyebrow: string;
  headline: string;
  body: string;
  stopLabel: string;
  imagePosition?: string;
};

type TrangAnScrollStoryProps = {
  beats: readonly TrangAnStoryBeat[];
  sectionLabel: string;
  title: string;
  progressLabel: string;
};

const ACCENTS = ["#d8b36a", "#9bc4b2", "#d9d6c5", "#b6cf72", "#e2a869", "#9ac8c0"];

/**
 * A self-contained editorial scene. Its default markup deliberately remains
 * readable in source order; GSAP only turns it into a pinned scene when the
 * visitor has a desktop viewport and has not requested reduced motion.
 */
export function TrangAnScrollStory({
  beats,
  sectionLabel,
  title,
  progressLabel,
}: TrangAnScrollStoryProps) {
  const rootRef = useRef<HTMLElement>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const root = rootRef.current;
    if (!root || beats.length < 2 || reducedMotion) return;

    gsap.registerPlugin(ScrollTrigger);
    const media = gsap.matchMedia();

    const context = gsap.context(() => {
      media.add("(min-width: 768px)", () => {
        const scene = root.querySelector<HTMLElement>("[data-story-scene]");
        const beatNodes = Array.from(root.querySelectorAll<HTMLElement>("[data-story-beat]"));
        const routeProgress = root.querySelector<SVGPathElement>("[data-story-route-progress]");
        const progressCurrent = root.querySelector<HTMLElement>("[data-story-current]");
        const progressTotal = root.querySelector<HTMLElement>("[data-story-total]");
        const stops = Array.from(root.querySelectorAll<HTMLElement>("[data-story-stop]"));

        if (!scene || beatNodes.length < 2) return;

        let activeIndex = -1;
        const setActive = (nextActiveIndex: number) => {
          if (nextActiveIndex === activeIndex) return;
          activeIndex = nextActiveIndex;
          beatNodes.forEach((node, index) => {
            const isActive = index === nextActiveIndex;
            node.dataset.active = isActive ? "true" : "false";
          });
          stops.forEach((stop, index) => {
            stop.dataset.active = index === nextActiveIndex ? "true" : "false";
          });
          if (progressCurrent) {
            progressCurrent.textContent = String(nextActiveIndex + 1).padStart(2, "0");
          }
          root.style.setProperty(
            "--trang-an-accent",
            ACCENTS[nextActiveIndex % ACCENTS.length],
          );
        };

        const routeLength = routeProgress?.getTotalLength() ?? 1;
        if (routeProgress) {
          gsap.set(routeProgress, { strokeDasharray: routeLength, strokeDashoffset: routeLength });
        }
        if (progressTotal) progressTotal.textContent = String(beatNodes.length).padStart(2, "0");

        beatNodes.forEach((node, index) => {
          const mediaNode = node.querySelector<HTMLElement>("[data-story-media]");
          const copy = node.querySelector<HTMLElement>("[data-story-copy]");
          const image = mediaNode?.querySelector("img");
          if (!mediaNode || !copy || !image) return;

          gsap.set(node, { position: "absolute", inset: 0, zIndex: index + 1 });
          gsap.set(mediaNode, {
            clipPath: index === 0 ? "inset(0% 0% 0% 0%)" : "inset(100% 0% 0% 0%)",
          });
          // Opacity keeps every article in the accessibility tree. `autoAlpha`
          // would also set visibility:hidden, leaving screen-reader users with
          // only one of the five beats and no semantic control to reveal the rest.
          gsap.set(copy.children, { opacity: index === 0 ? 1 : 0, y: index === 0 ? 0 : 18 });
          gsap.set(image, { scale: 1.1, yPercent: index === 0 ? 0 : 3 });
        });
        setActive(0);

        const timeline = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: {
            trigger: root,
            start: "top top",
            end: () => `+=${Math.max(1800, (beatNodes.length - 1) * window.innerHeight * 1.18)}`,
            pin: scene,
            scrub: 0.65,
            invalidateOnRefresh: true,
            onUpdate: (self) => {
              const nextActiveIndex = Math.min(
                beatNodes.length - 1,
                Math.max(0, Math.round(self.progress * (beatNodes.length - 1))),
              );
              setActive(nextActiveIndex);
            },
          },
        });

        // A restrained, continuous camera drift prevents the scene becoming a static slideshow.
        beatNodes.forEach((node) => {
          const image = node.querySelector("[data-story-media] img");
          if (image) timeline.to(image, { scale: 1.015, duration: 1 }, 0);
        });

        const segment = 1 / (beatNodes.length - 1);
        beatNodes.slice(1).forEach((node, index) => {
          const previous = beatNodes[index];
          const previousCopy = previous.querySelector<HTMLElement>("[data-story-copy]");
          const currentCopy = node.querySelector<HTMLElement>("[data-story-copy]");
          const currentMedia = node.querySelector<HTMLElement>("[data-story-media]");
          const currentImage = currentMedia?.querySelector("img");
          const position = index * segment;

          if (!previousCopy || !currentCopy || !currentMedia || !currentImage) return;

          // Copy clears before the image wipe so no mask ever cuts through a headline.
          timeline.to(previousCopy.children, { opacity: 0, y: -16, duration: segment * 0.14, stagger: 0.012 }, position + segment * 0.3);
          timeline.to(currentMedia, { clipPath: "inset(0% 0% 0% 0%)", duration: segment * 0.25 }, position + segment * 0.48);
          timeline.to(currentImage, { yPercent: 0, duration: segment * 0.25 }, position + segment * 0.48);
          timeline.to(currentCopy.children, { opacity: 1, y: 0, duration: segment * 0.16, stagger: 0.018 }, position + segment * 0.76);
          if (routeProgress) {
            timeline.to(
              routeProgress,
              {
                strokeDashoffset:
                  routeLength * (1 - (index + 1) / (beatNodes.length - 1)),
                duration: segment * 0.55,
              },
              position + segment * 0.3,
            );
          }
        });

        return () => {
          root.style.removeProperty("--trang-an-accent");
        };
      });

    }, root);

    return () => {
      media.revert();
      context.revert();
    };
  }, [beats, reducedMotion]);

  if (beats.length === 0) return null;

  return (
    <section
      ref={rootRef}
      className={styles.root}
      data-testid="trang-an-scroll-story"
      data-motion={reducedMotion ? "reduced" : "full"}
    >
      <div className={styles.scene} data-story-scene>
        <header className={styles.intro}>
          <p className={styles.sectionLabel}>{sectionLabel}</p>
          <h2 className={styles.title}>{title}</h2>
        </header>

        <div className={styles.route} aria-hidden="true">
          <svg viewBox="0 0 88 356" preserveAspectRatio="none" focusable="false">
            <path className={styles.routeBase} d="M42 4C17 40 75 70 43 110S17 182 45 220 71 286 42 352" />
            <path className={styles.routeProgress} data-story-route-progress d="M42 4C17 40 75 70 43 110S17 182 45 220 71 286 42 352" />
          </svg>
        </div>

        <ol className={styles.stopRail} aria-label={progressLabel}>
          {beats.map((beat, index) => (
            <li key={beat.id} className={styles.stop} data-story-stop={index}>
              <span className={styles.stopDot} />
              <span className={styles.stopLabel}>{beat.stopLabel}</span>
            </li>
          ))}
        </ol>

        <div className={styles.counter} aria-hidden="true">
          <span data-story-current>{"01"}</span>
          <span className={styles.counterRule} aria-hidden="true" />
          <span data-story-total>{String(beats.length).padStart(2, "0")}</span>
        </div>

        <div className={styles.beats}>
          {beats.map((beat, index) => (
            <article key={beat.id} className={styles.beat} data-story-beat data-active={index === 0 ? "true" : "false"}>
              <div className={styles.media} data-story-media>
                <Image
                  src={beat.image}
                  alt={beat.alt}
                  fill
                  sizes="100vw"
                  className={styles.image}
                  style={{ objectPosition: beat.imagePosition ?? "center" }}
                />
                <div className={styles.verticalScrim} />
                <div className={styles.horizontalScrim} />
              </div>
              <div className={styles.copy} data-story-copy>
                <p className={styles.eyebrow}>{beat.eyebrow}</p>
                <h3 className={styles.headline}>{beat.headline}</h3>
                <p className={styles.body}>{beat.body}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
