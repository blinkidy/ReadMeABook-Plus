/**
 * Component: BookDate Card Stack
 * Documentation: documentation/features/bookdate-animations.md
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { RecommendationCard } from './RecommendationCard';
import type { BookDateRequestFormat } from './RecommendationCard';

interface CardStackProps {
  recommendations: any[];
  currentIndex: number;
  onSwipe: (action: 'left' | 'right' | 'up', markedAsKnown?: boolean, requestFormat?: BookDateRequestFormat) => void;
  onSwipeComplete: () => void;
  onShowDetails?: () => void; // Callback to show details modal
}

export function CardStack({
  recommendations,
  currentIndex,
  onSwipe,
  onSwipeComplete,
  onShowDetails,
}: CardStackProps) {
  const [isExiting, setIsExiting] = useState(false);
  const [exitDirection, setExitDirection] = useState<'left' | 'right' | 'up' | null>(null);
  const [isAdvancing, setIsAdvancing] = useState(false);

  // Reset animation states when currentIndex changes externally (e.g., undo)
  useEffect(() => {
    setIsExiting(false);
    setExitDirection(null);
    setIsAdvancing(false);
  }, [currentIndex]);

  const handleSwipeStart = useCallback(
    (action: 'left' | 'right' | 'up', markedAsKnown?: boolean, requestFormat?: BookDateRequestFormat) => {
      // Prevent swipes during animation
      if (isExiting || isAdvancing) {
        return;
      }

      // Start exit animation
      setIsExiting(true);
      setExitDirection(action);

      // Call parent's onSwipe (for API call)
      onSwipe(action, markedAsKnown, requestFormat);

      // Wait for exit animation to complete (400ms)
      setTimeout(() => {
        setIsExiting(false);
        setExitDirection(null);

        // Start advance animation
        setIsAdvancing(true);

        // Wait for advance animation to complete (350ms)
        setTimeout(() => {
          setIsAdvancing(false);
          // Notify parent that animations are complete
          onSwipeComplete();
        }, 350);
      }, 400);
    },
    [isExiting, isAdvancing, onSwipe, onSwipeComplete]
  );

  // Get up to 3 cards to display
  const visibleCards = [];

  if (isAdvancing) {
    // During advance, skip the card that just exited (at currentIndex)
    // Show cards at indices: currentIndex+1, currentIndex+2, currentIndex+3
    for (let i = 0; i < 3; i++) {
      const index = currentIndex + 1 + i;
      if (index < recommendations.length) {
        visibleCards.push({
          recommendation: recommendations[index],
          index,
          stackPosition: i, // Target position (0, 1, 2)
          fromPosition: i + 1, // Source position for animation (1, 2, 3)
        });
      }
    }
  } else {
    // Normal rendering: show current card and next 2
    for (let i = 0; i < 3; i++) {
      const index = currentIndex + i;
      if (index < recommendations.length) {
        visibleCards.push({
          recommendation: recommendations[index],
          index,
          stackPosition: i,
        });
      }
    }
  }

  // If we have no cards, return null
  if (visibleCards.length === 0) {
    return null;
  }

  return (
    <div className="card-stack-container relative w-full max-w-md h-[calc(80vh)] md:h-[calc(85vh)]">
      {visibleCards.map((card, arrayIndex) => {
        const isTopCard = card.stackPosition === 0;
        const isExitingCard = isTopCard && isExiting;

        // Determine animation class
        let animationClass = '';
        if (isExitingCard && exitDirection) {
          animationClass = `animate-exit-${exitDirection}`;
        } else if (isAdvancing && card.fromPosition !== undefined) {
          // Cards are advancing from their previous position
          if (card.fromPosition === 1) {
            animationClass = 'animate-advance-to-top'; // 1 → 0
          } else if (card.fromPosition === 2) {
            animationClass = 'animate-advance-to-middle'; // 2 → 1
          } else if (card.fromPosition === 3) {
            animationClass = 'animate-enter'; // 3 → 2 (new card)
          }
        }

        // Determine static position class (when not animating)
        const positionClass = !animationClass
          ? `card-stack-position-${card.stackPosition}`
          : '';

        return (
          <div
            key={card.index}
            className={`card-stack-item absolute inset-0 ${positionClass} ${animationClass}`}
            style={{
              // Ensure proper stacking even without animation
              zIndex: 50 - card.stackPosition * 10,
            }}
          >
            <RecommendationCard
              recommendation={card.recommendation}
              onSwipe={handleSwipeStart}
              onShowDetails={isTopCard ? onShowDetails : undefined}
              stackPosition={card.stackPosition}
              isAnimating={isExiting || isAdvancing}
              isDraggable={isTopCard && !isExiting && !isAdvancing}
            />
          </div>
        );
      })}
    </div>
  );
}
