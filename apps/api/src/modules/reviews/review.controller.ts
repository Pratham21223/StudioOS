import type { RequestHandler } from "express";
import {
  createInternalReview,
  listContentReviews,
  listOrganizationReviews,
} from "./review.service.js";
import type { CreateInternalReviewInput, ReviewListQuery } from "./review.validation.js";

export const getContentReviews: RequestHandler = async (req, res) => {
  const reviews = await listContentReviews(req.tenant!, req.params.contentId as string);
  res.status(200).json({ reviews });
};

export const postContentReview: RequestHandler = async (req, res) => {
  const review = await createInternalReview(
    req.tenant!,
    req.auth!.userId,
    req.params.contentId as string,
    req.body as CreateInternalReviewInput,
  );
  res.status(201).json({ review });
};

export const getReviews: RequestHandler = async (req, res) => {
  const reviews = await listOrganizationReviews(req.tenant!, res.locals.query as ReviewListQuery);
  res.status(200).json({ reviews });
};
