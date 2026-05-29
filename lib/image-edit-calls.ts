import OpenAI, { toFile } from "openai";
import {
  imageModelUsesFluxGenerations,
  type ParsedGatewayEditFields,
} from "@/lib/image-gateway-fields";
import {
  buildOpenAiImagesEditParams,
  imagesEditViaGatewayMultipart,
  openAiImagesEditUsesMinimalParams,
} from "@/lib/openai-image-gateway";
import { runReplicateGptImage2 } from "@/lib/replicate-gpt-image-2";
import { extFromMime } from "@/lib/image-buffer-utils";

export type ImageCtx =
  | { provider: "openai"; openai: OpenAI; baseURL: string; apiKey: string }
  | { provider: "replicate"; token: string };

export function replicateDownloadAuth(ctx: ImageCtx): string | undefined {
  return ctx.provider === "replicate" ? ctx.token : undefined;
}

export function firstImageUrl(res: OpenAI.Images.ImagesResponse): string | null {
  const item = res.data?.[0];
  if (!item) return null;
  if (item.url) return item.url;
  if (item.b64_json) {
    return `data:image/png;base64,${item.b64_json}`;
  }
  return null;
}

export async function editOnce(
  ctx: { openai: OpenAI; baseURL: string; apiKey: string },
  buffer: Buffer,
  ext: string,
  mime: string,
  prompt: string,
  gateway: ParsedGatewayEditFields,
): Promise<string | null> {
  const { model, aspectRatio, imageSize, fluxSize } = gateway;
  const images = [{ buffer, mime, filename: `input.${ext}` }];
  if (imageModelUsesFluxGenerations(model)) {
    if (openAiImagesEditUsesMinimalParams(ctx.baseURL)) {
      return imagesEditViaGatewayMultipart({
        apiKey: ctx.apiKey,
        baseURL: ctx.baseURL,
        model,
        prompt,
        images,
        fluxSize,
      });
    }
    const uploadable = await toFile(buffer, `input.${ext}`, { type: mime });
    const res = (await ctx.openai.images.edit(
      buildOpenAiImagesEditParams(
        ctx.baseURL,
        { model, image: uploadable, prompt },
        { fluxSize },
      ),
    )) as OpenAI.Images.ImagesResponse;
    return firstImageUrl(res);
  }
  if (openAiImagesEditUsesMinimalParams(ctx.baseURL)) {
    return imagesEditViaGatewayMultipart({
      apiKey: ctx.apiKey,
      baseURL: ctx.baseURL,
      model,
      prompt,
      images,
      aspectRatio,
      imageSize,
    });
  }
  const uploadable = await toFile(buffer, `input.${ext}`, { type: mime });
  const res = (await ctx.openai.images.edit(
    buildOpenAiImagesEditParams(ctx.baseURL, {
      model,
      image: uploadable,
      prompt,
    }),
  )) as OpenAI.Images.ImagesResponse;
  return firstImageUrl(res);
}

export async function editOnceRoute(
  ctx: ImageCtx,
  buffer: Buffer,
  ext: string,
  mime: string,
  prompt: string,
  gateway: ParsedGatewayEditFields,
): Promise<string | null> {
  if (ctx.provider === "replicate") {
    return runReplicateGptImage2({
      token: ctx.token,
      prompt,
      images: [{ buffer, mime, filename: `input.${ext}` }],
    });
  }
  return editOnce(ctx, buffer, ext, mime, prompt, gateway);
}

/** 第一张：场景（模特或饰品陈列），第二张：美甲产品 */
export async function editDualSceneNails(
  ctx: { openai: OpenAI; baseURL: string; apiKey: string },
  sceneBuffer: Buffer,
  sceneMime: string,
  nailsBuffer: Buffer,
  nailsMime: string,
  prompt: string,
  gateway: ParsedGatewayEditFields,
): Promise<string | null> {
  const { model, aspectRatio, imageSize, fluxSize } = gateway;
  const sceneExt = extFromMime(sceneMime);
  const nailsExt = extFromMime(nailsMime);
  const images = [
    {
      buffer: sceneBuffer,
      mime: sceneMime,
      filename: `scene.${sceneExt}`,
    },
    {
      buffer: nailsBuffer,
      mime: nailsMime,
      filename: `nails.${nailsExt}`,
    },
  ];
  if (imageModelUsesFluxGenerations(model)) {
    if (openAiImagesEditUsesMinimalParams(ctx.baseURL)) {
      return imagesEditViaGatewayMultipart({
        apiKey: ctx.apiKey,
        baseURL: ctx.baseURL,
        model,
        prompt,
        images,
        fluxSize,
      });
    }
    const sceneFile = await toFile(sceneBuffer, `scene.${sceneExt}`, {
      type: sceneMime,
    });
    const nailsFile = await toFile(nailsBuffer, `nails.${nailsExt}`, {
      type: nailsMime,
    });
    const res = (await ctx.openai.images.edit(
      buildOpenAiImagesEditParams(
        ctx.baseURL,
        { model, image: [sceneFile, nailsFile], prompt },
        { fluxSize },
      ),
    )) as OpenAI.Images.ImagesResponse;
    return firstImageUrl(res);
  }
  if (openAiImagesEditUsesMinimalParams(ctx.baseURL)) {
    return imagesEditViaGatewayMultipart({
      apiKey: ctx.apiKey,
      baseURL: ctx.baseURL,
      model,
      prompt,
      images,
      aspectRatio,
      imageSize,
    });
  }
  const sceneFile = await toFile(sceneBuffer, `scene.${sceneExt}`, {
    type: sceneMime,
  });
  const nailsFile = await toFile(nailsBuffer, `nails.${nailsExt}`, {
    type: nailsMime,
  });
  const res = (await ctx.openai.images.edit(
    buildOpenAiImagesEditParams(ctx.baseURL, {
      model,
      image: [sceneFile, nailsFile],
      prompt,
    }),
  )) as OpenAI.Images.ImagesResponse;
  return firstImageUrl(res);
}

export async function editDualSceneNailsRoute(
  ctx: ImageCtx,
  firstBuffer: Buffer,
  firstMime: string,
  secondBuffer: Buffer,
  secondMime: string,
  prompt: string,
  gateway: ParsedGatewayEditFields,
): Promise<string | null> {
  if (ctx.provider === "replicate") {
    const firstExt = extFromMime(firstMime);
    const secondExt = extFromMime(secondMime);
    return runReplicateGptImage2({
      token: ctx.token,
      prompt,
      images: [
        { buffer: firstBuffer, mime: firstMime, filename: `first.${firstExt}` },
        { buffer: secondBuffer, mime: secondMime, filename: `second.${secondExt}` },
      ],
    });
  }
  return editDualSceneNails(
    ctx,
    firstBuffer,
    firstMime,
    secondBuffer,
    secondMime,
    prompt,
    gateway,
  );
}
