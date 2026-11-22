import type { RequestHandler } from "express";
import {
  completeUpload,
  createAssetDownloadUrl,
  createUploadIntent,
  getAsset,
  listAssets,
  listContentAssets,
} from "./asset.service.js";
import type { AssetListQuery, CreateUploadIntentInput } from "./asset.validation.js";

export const getAssets: RequestHandler = async (req, res) => {
  const assets = await listAssets(req.tenant!, res.locals.query as AssetListQuery);
  res.status(200).json({ assets });
};

export const getContentAssets: RequestHandler = async (req, res) => {
  const assets = await listContentAssets(req.tenant!, req.params.contentId as string);
  res.status(200).json({ assets });
};

export const getAssetById: RequestHandler = async (req, res) => {
  const asset = await getAsset(req.tenant!, req.params.assetId as string);
  res.status(200).json({ asset });
};

export const postUploadIntent: RequestHandler = async (req, res) => {
  const intent = await createUploadIntent(
    req.tenant!,
    req.auth!.userId,
    req.body as CreateUploadIntentInput,
  );
  res.status(201).json({ intent });
};

export const postCompleteUpload: RequestHandler = async (req, res) => {
  const asset = await completeUpload(req.tenant!, req.auth!.userId, req.body.uploadId as string);
  res.status(201).json({ asset });
};

export const postAssetDownloadUrl: RequestHandler = async (req, res) => {
  const disposition = req.body?.disposition === "inline" ? "inline" : "attachment";
  const download = await createAssetDownloadUrl(
    req.tenant!,
    req.params.assetId as string,
    disposition,
  );
  res.status(200).json(download);
};
