<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import * as THREE from "three";
  import * as ThreeGLTFLoader from "three/examples/jsm/loaders/GLTFLoader.js";
  import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
  import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
  import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
  import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

  import JSZip from "jszip";
  import { cubicOut } from "svelte/easing";
  import { toastManager } from "./toast.svelte";
  import { fly, fade, scale } from "svelte/transition";
  import {
    currentBook,
    isReadingMode,
    isPreviewMode,
    TransferAct,
  } from "$lib/services/global.svelte";
  import { indexed } from "$lib/services/indexed.svelte";
  import { encryptBuffer, decryptBuffer } from "$lib/services/crypto";
  import { getAssetUrl } from "$lib/services/server.svelte";

  interface PageInfo {
    root: any;
    page: any;
    video?: boolean;
  }

  interface BookInfo {
    id: string;
    title: string;
    desc?: string;
    description_url?: string; // 🌟 상세 소개 텍스트 파일 경로 (desc.txt)
    thumbnail: string;
    video_thumbnail?: string; // 영상 표지 경로 (cover.mp4)
    epub_url: string; // 정식 원본 EPUB 경로 (book.epub)
    preview_epub_url?: string; // 🌟 서버가 자동 생성한 5페이지 맛보기 EPUB 경로 (preview.epub)
    author: string;
    publisher?: string; // 🌟 출판사
    price?: number; // 판매가
    original_price?: number; // 🌟 정가 (할인율 표시용)
    purchase_time?: number; // 구매 일시 타임스탬프
    last_view?: number;
    user_read?: number; // 마지막 읽은 페이지 인덱스
    progress?: number; // 독서 진행률 (%)
    rating?: number; // 평점 (선택)
    rating_count?: number; // 리뷰 수 (선택)
  }

  let showBuyGuideModal = $state(false);

  // 🌟 오직 currentBook.value만 추적하여 원치 않는 재실행 방지
  $effect(() => {
    const book = currentBook.value;
    if (book) {
      showBuyGuideModal = false;
      ClickBookListFromModal(book);
    }
  });

  onMount(() => {
    TransferAct["OpenBookList"] = OpenBookList;
    requestAnimationFrame(() => {
      const targetDiv = document.getElementById("viewer");
      initThreeWithGLB(targetDiv as HTMLDivElement).then(() => {
        LoadUIButtons();
        OpenBookList();
      });
    });
  });

  let threeContext = null;
  let PagePaths: string[] = $state(undefined);
  let targetBloom: number;
  let controls: any;
  let isReadingBook = false;
  let ViewPageTarget = null;
  let boundingBox = {
    reinit: true,
    center: null,
    size: null,
  };
  let PageSize = {
    x: 0,
    y: 0,
  };
  let EmptyPageObj = null;
  let CurrentViewPage = 0;
  let UserViewPage = $state(0);
  let AllPages: PageInfo[] = [];
  let PAGE_THICKNESS = 0.001;
  let singlePageForm = false;
  let LookCoverStatus = $state("idle");
  let CurrentBookInfo: BookInfo;

  // 🌟 [보안 및 메모리 코어] RAM 상에서만 유지되는 비공개 객체들
  let inMemoryZip: JSZip | null = null;
  let inMemoryThumbnails: THREE.Texture[] = [];
  let highResTextures: Map<string, THREE.Texture> = new Map();

  async function OpenBookList() {
    showBuyGuideModal = false;
    await ChooseBtn();
    currentBook.value = null;
    clearHighResCache();
  }

  let LastViewedBookId = $state("");

  async function ClickBookListFromModal(info: BookInfo) {
    if (LastViewedBookId == info.id) return;
    LastViewedBookId = info.id;
    CurrentBookInfo = info;

    playAnimation(EmptyPageObj, "BookShow", {
      reverse: true,
      onFinished: () => {
        isCoverAnimPlaying = true;
        disposeObject3D(EmptyPageObj, { keepRoot: true });
        const willRemove = threeContext.scene?.getObjectByName("book_model");
        disposeObject3D(willRemove);
        const book_model = threeContext.book_model.scene.clone();
        book_model.name = "book_model";
        threeContext.scene.add(book_model);
      },
    });

    clearHighResCache();
    await LoadEpubSecurely(info);
  }

  async function initThreeWithGLB(container: HTMLDivElement) {
    if (threeContext) return threeContext;

    const scene = new THREE.Scene();
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    const loader = new ThreeGLTFLoader.GLTFLoader();
    const glbURL = "assets/model/env.glb";
    const book = "assets/model/book.glb";
    const env = await loader.loadAsync(glbURL);
    const book_model = await loader.loadAsync(book);

    scene.add(env.scene);

    let camera = null;
    if (env.cameras && env.cameras.length > 0) {
      camera = env.cameras[0];
    } else {
      camera = new THREE.PerspectiveCamera(
        75,
        container.clientWidth / container.clientHeight,
        0.1,
        1000,
      );
      camera.position.set(0, 1, 5);
      scene.add(camera);

      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.1;
      controls.target.set(0, 0, 0);
      controls.update();

      const light = new THREE.PointLight(0xffffff, 1);
      light.position.set(1, 1, 1);
      scene.add(light);
    }

    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    const fitCameraToObject = (camera: any, object: any, offset = 1.1) => {
      if (boundingBox.reinit) {
        const box = new THREE.Box3().setFromObject(object);
        const size = new THREE.Vector3();
        box.getSize(size);
        const center = new THREE.Vector3();
        box.getCenter(center);

        boundingBox.center = { x: center.x, y: center.y };
        boundingBox.size = { x: size.x, y: size.y };
        boundingBox.reinit = false;
      }

      const aspect = camera.aspect;
      const vFov = THREE.MathUtils.degToRad(camera.fov);
      const distanceY = boundingBox.size.y / 2 / Math.tan(vFov / 2);
      const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
      const distanceX = boundingBox.size.x / 2 / Math.tan(hFov / 2);
      const distance = Math.max(distanceX, distanceY) * offset;

      camera.position.set(
        boundingBox.center.x,
        boundingBox.center.y,
        boundingBox.center.z + distance,
      );
      camera.lookAt(boundingBox.center);
      return boundingBox.center;
    };

    const composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(container.clientWidth / 2, container.clientHeight / 2),
      1.5,
      0.4,
      0.85,
    );
    composer.addPass(bloomPass);

    const resizeCameraAspect = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      const aspect = width / height;

      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(width, height);
      composer?.setSize(width, height);

      camera.aspect = aspect;
      camera.updateProjectionMatrix();

      if (LookCoverStatus != "idle")
        animateFOV(threeContext.camera, calcFitFOV());
      else animateFOV(threeContext?.camera, 22.89519);

      if (isReadingBook && ViewPageTarget)
        fitCameraToObject(camera, ViewPageTarget, aspect);

      controls?.update();
    };
    window.onresize = resizeCameraAspect;
    resizeCameraAspect();
    setTimeout(() => resizeCameraAspect(), 1000);

    let page = null;
    let removeTargets = [];
    book_model.scene.traverse((obj) => {
      switch (obj.name) {
        case "PageRoot":
          page = obj.clone(true);
          removeTargets.push(obj);
          break;
        case "book_cover":
          removeTargets.push(obj);
          break;
      }
    });
    removeTargets.forEach((obj) => obj.removeFromParent?.());

    let updateParticles: Function;
    env.scene.traverse((obj) => {
      switch (obj.name) {
        case "main_spot":
          obj["intensity"] = 0;
          const animate = () => {
            const animId = requestAnimationFrame(animate);
            if (obj["intensity"] < 100) {
              obj["intensity"] += 2;
            } else {
              obj["intensity"] = 100;
              cancelAnimationFrame(animId);
            }
          };
          animate();
          obj.castShadow = true;
          obj.receiveShadow = false;
          break;
        case "bookPos":
          EmptyPageObj = obj;
          break;
        case "bottom":
          obj.receiveShadow = true;
          obj.matrixAutoUpdate = false;
          obj.castShadow = false;
          break;
        case "particlePos":
          const spawnPosition = new THREE.Vector3();
          obj.getWorldPosition(spawnPosition);

          const COUNT = 30;
          const geometry = new THREE.BufferGeometry();
          const positions = new Float32Array(COUNT * 3);
          const velocities = new Float32Array(COUNT);
          const life = new Float32Array(COUNT);
          const sizes = new Float32Array(COUNT);
          const SPAWN_RADIUS = 0.4;

          for (let i = 0; i < COUNT; i++) {
            positions[i * 3 + 0] =
              spawnPosition.x + (Math.random() - 0.5) * SPAWN_RADIUS;
            positions[i * 3 + 1] = spawnPosition.y;
            positions[i * 3 + 2] =
              spawnPosition.z + (Math.random() - 0.5) * SPAWN_RADIUS;
            velocities[i] = 0.001 + Math.random() * 0.002;
            life[i] = Math.random();
            const t = life[i];
            sizes[i] = 1.0 - t;
          }

          geometry.setAttribute(
            "position",
            new THREE.BufferAttribute(positions, 3),
          );
          geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

          const material = new THREE.PointsMaterial({
            size: 0.025,
            color: 0xffffff,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          });

          const particles = new THREE.Points(geometry, material);
          scene.add(particles);

          updateParticles = () => {
            const pos = geometry.attributes["position"].array;
            for (let i = 0; i < COUNT; i++) {
              const i3 = i * 3;
              life[i] += 0.002;
              pos[i3 + 1] += velocities[i];
              const t = life[i];
              sizes[i] = 1.0 - t;

              if (life[i] >= 1.0) {
                life[i] = 0;
                pos[i3 + 0] = spawnPosition.x + (Math.random() - 0.5);
                pos[i3 + 1] = spawnPosition.y;
                pos[i3 + 2] = spawnPosition.z + (Math.random() - 0.5);
                velocities[i] = 0.001 + Math.random() * 0.002;
                sizes[i] = 1.0;
              }
            }
            geometry.attributes["position"].needsUpdate = true;
            geometry.attributes["size"].needsUpdate = true;
          };
          break;
      }
    });

    const clock = new THREE.Timer();
    targetBloom = 0.025;
    let bloomStrength = 0.05;

    const updateBloom = (delta: number) => {
      bloomStrength += (targetBloom - bloomStrength) * delta * 2;
      bloomPass.strength = bloomStrength;
    };

    const animate = () => {
      clock.update();
      const delta = clock.getDelta();

      updateBloom(delta);
      updateParticles?.();
      controls?.update();
      mixers.forEach((mixer) => mixer.update(delta));
      updateMoveAnimation(delta);
      renderer.render(scene, camera);
      composer.render();
    };

    renderer.setAnimationLoop(animate);

    threeContext = {
      scene: scene,
      camera: camera,
      renderer: renderer,
      env: env,
      book_model: book_model,
      page: page,
      container: container,
    };

    return threeContext;
  }

  let VideoTexTag: HTMLVideoElement;
  let VideoTexture: any;
  async function CreateVideoTexTag(obj: any, path: string) {
    try {
      RemoveVideoElement();
      let VideoTexTag = document.createElement("video");

      // 🌟 필수 추가: WebGL 텍스처 변환을 위한 CORS 허용 요청 플래그
      VideoTexTag.crossOrigin = "anonymous";

      VideoTexTag.src = getAssetUrl(path);
      VideoTexTag.loop = true;
      VideoTexTag.muted = true;
      VideoTexTag.playsInline = true;

      await VideoTexTag.play();

      VideoTexture = new THREE.VideoTexture(VideoTexTag);
      VideoTexture.flipY = false;

      const targetObj = obj.getObjectByName("Plane");
      targetObj.material.map = VideoTexture;
    } catch (e) {
      console.log("비디오 생성 실패: ", e);
      throw e;
    }
  }

  function RemoveVideoElement() {
    if (VideoTexTag) {
      VideoTexTag.pause();
      VideoTexTag.src = "";
      VideoTexTag.load();
      VideoTexTag.remove();
    }
    VideoTexture?.dispose();
  }

  async function playAnimation(
    target: THREE.Object3D,
    clipName: string,
    options?: {
      loop?: THREE.AnimationActionLoopStyles;
      repetitions?: number;
      reverse?: boolean;
      clampWhenFinished?: boolean;
      onFinished?: () => void;
    },
  ) {
    const ctx = threeContext;
    if (!ctx) return null;

    const clip = THREE.AnimationClip.findByName(ctx.env.animations, clipName);
    const mixer = new THREE.AnimationMixer(target);
    const action = mixer.clipAction(clip, target);

    await new Promise((done: any) => {
      if (!clip) {
        console.log("애니메이션 클립 누락:", clipName);
        return null;
      }

      const {
        loop = THREE.LoopOnce,
        repetitions = 1,
        clampWhenFinished = true,
        onFinished,
      } = options || {};

      action.reset();
      action.timeScale = options?.reverse ? -1 : 1;
      action.time = options?.reverse ? clip.duration : 0;
      action.setLoop(loop, repetitions);
      action.clampWhenFinished = clampWhenFinished;
      action.play();

      mixers.push(mixer);

      const finishedHandler = () => {
        mixers = mixers.filter((m) => m !== mixer);
        mixer.removeEventListener("finished", finishedHandler);
        onFinished?.();
        done();
      };

      mixer.addEventListener("finished", finishedHandler);
    });

    return { mixer, action, clip };
  }

  let pageAnimationMap = new Map<
    THREE.Object3D,
    {
      mixer: THREE.AnimationMixer;
      rootAction: THREE.AnimationAction;
      pageAction: THREE.AnimationAction;
    }
  >();

  let mixers = [];
  function playPageAnimation(
    target: THREE.Object3D,
    key: string,
    reverse = false,
  ) {
    const ctx = threeContext;
    if (!ctx) return;

    const parent = target.parent;
    if (!parent) return;

    const rootClip = THREE.AnimationClip.findByName(
      ctx.book_model.animations,
      "PageRootAction",
    );
    const clip = THREE.AnimationClip.findByName(ctx.book_model.animations, key);

    if (!rootClip || !clip) return;

    let state = pageAnimationMap.get(target);

    if (!state) {
      const mixer = new THREE.AnimationMixer(parent);
      const rootAction = mixer.clipAction(rootClip, parent);
      const pageAction = mixer.clipAction(clip, target);

      rootAction.setLoop(THREE.LoopOnce, 1);
      pageAction.setLoop(THREE.LoopOnce, 1);

      rootAction.clampWhenFinished = true;
      pageAction.clampWhenFinished = true;

      mixers.push(mixer);

      state = { mixer, rootAction, pageAction };
      pageAnimationMap.set(target, state);
    }

    const { rootAction, pageAction } = state;
    const currentTime = pageAction.time;

    rootAction.paused = false;
    pageAction.paused = false;
    rootAction.timeScale = reverse ? -1 : 1;
    pageAction.timeScale = reverse ? -1 : 1;
    rootAction.time = currentTime;
    pageAction.time = currentTime;

    if (reverse && currentTime <= 0) {
      rootAction.time = clip.duration;
      pageAction.time = clip.duration;
    }

    if (!reverse && currentTime >= clip.duration) {
      rootAction.time = 0;
      pageAction.time = 0;
    }

    rootAction.play();
    pageAction.play();
  }

  function applyEmptyTransform(targetObject: any, emptyObject: any) {
    if (!targetObject || !emptyObject) return targetObject;
    targetObject.removeFromParent?.();
    emptyObject.add(targetObject);
    targetObject.position.set(0, 0, 0);
    targetObject.quaternion.identity();
    targetObject.scale.set(1, 1, 1);
    return targetObject;
  }

  function easeInOutSine(t: number) {
    return -(Math.cos(Math.PI * t) - 1) / 2;
  }

  function calcFitFOV() {
    const dist = 2.88446;
    const ratio = 3500;
    const vFOV = 2 * Math.atan(PageSize.y / ratio / (2 * dist));
    const hFOV = 2 * Math.atan(PageSize.x / ratio / (2 * dist));
    const hFOV_as_vFOV =
      2 * Math.atan(Math.tan(hFOV / 2) / threeContext.camera.aspect);
    const finalFOV = Math.max(vFOV, hFOV_as_vFOV);
    return THREE.MathUtils.radToDeg(finalFOV);
  }

  function animateFOV(camera: any, targetFov: number, duration = 1000) {
    if (!camera) return;
    cancelAnimationFrame(camera._fovRAF);

    const startFov = camera.fov;
    const startTime = performance.now();

    const update = (now: number) => {
      const t = Math.min((now - startTime) / duration, 1);
      const eased = easeInOutSine(t);
      camera.fov = startFov + (targetFov - startFov) * eased;
      camera.updateProjectionMatrix();

      if (t < 1) {
        camera._fovRAF = requestAnimationFrame(update);
      } else {
        camera.fov = targetFov;
        camera.updateProjectionMatrix();
        camera._fovRAF = null;
      }
    };

    camera._fovRAF = requestAnimationFrame(update);
  }

  let isCoverAnimPlaying = true;
  async function LoadUIButtons() {
    console.log("LoadUIButtons");
  }

  function idle_zoom_act() {
    animateFOV(threeContext.camera, calcFitFOV());
    if (AllPages[0].video) {
      const cover = AllPages[0].page.getObjectByName("Plane");
      cover.material.emissive = new THREE.Color(0xffffff);
      cover.material.emissiveMap = VideoTexture;
      cover.material.emissiveIntensity = 0;
      animateEmissive(cover, 1, 1500);
    } else {
      LoadCurrentThumbnail(AllPages[0].page, 0, {
        isEmission: true,
        isFront: true,
        isOriginal: true,
      });
    }
    playAnimation(EmptyPageObj, "zoomCover", {
      onFinished: () => {
        isCoverAnimPlaying = false;
      },
    });
    LookCoverStatus = "front";
  }

  function MakeThumbnailPageCurrent() {
    const current = CurrentViewPage - 1;
    if (current > 0) {
      setTimeout(() => {
        if (!singlePageForm)
          LoadCurrentThumbnail(AllPages[current].page, current * 2, {
            isEmission: true,
            isFront: false,
            isOriginal: false,
          });
        LoadCurrentThumbnail(AllPages[current + 1]?.page, current * 2 + 1, {
          isEmission: true,
          isFront: true,
          isOriginal: false,
        });
      }, 1000);
    }
  }

  function back_cover_act() {
    animateFOV(threeContext.camera, calcFitFOV());
    playAnimation(EmptyPageObj, "lookCoverBack", {
      reverse: true,
      onFinished: () => {
        isCoverAnimPlaying = false;
      },
    });
    LookCoverStatus = "front";
  }

  function button_anim(node: any) {
    return {
      duration: 1000,
      easing: cubicOut,
      css: (t: number) => {
        return `
          overflow: hidden;
          opacity: ${t};
          width: ${t * 64}px;
          height: ${t * 64}px;
          margin-left: ${t * 16}px;
          border: ${t * 3}px double var(--threejs-button-border);
          font-size: ${t * 16}px;
        `;
      },
    };
  }

  function showFrontCover() {
    if (isCoverAnimPlaying) return;
    targetBloom = 0;
    isCoverAnimPlaying = true;
    switch (LookCoverStatus) {
      case "idle":
        idle_zoom_act();
        break;
      case "front":
        {
          if (CurrentViewPage == 0) {
            animateFOV(threeContext.camera, calcFitFOV());
            const lastModelIndex = AllPages.length - 1;
            const lastImageIndex = PagePaths.length - 1;
            LoadCurrentThumbnail(
              AllPages[lastModelIndex].page,
              lastImageIndex,
              {
                isEmission: true,
                isFront: false,
                isOriginal: true,
              },
            );
            playAnimation(EmptyPageObj, "lookCoverBack", {
              onFinished: () => {
                isCoverAnimPlaying = false;
              },
            });
            LookCoverStatus = "back";
          } else {
            toggleMove(
              threeContext.scene?.getObjectByName("page_center"),
              false,
            );
            const BackToFrontCover = async () => {
              toggleMove(
                threeContext.scene?.getObjectByName("page_center"),
                false,
              );
              MakeThumbnailPageCurrent();
              for (let i = 0, j = CurrentViewPage; i < j; i++) {
                PrevPage(true);
                await new Promise((done) => setTimeout(done, 70));
              }
              UserViewPage = 0;
              await new Promise((done) => setTimeout(done, 1000));
              isCoverAnimPlaying = false;
            };
            BackToFrontCover();
          }
        }
        break;
      case "back": {
        back_cover_act();
        break;
      }
    }
  }

  // 🌟 다음 버튼: 5페이지(인덱스 4) 도달 시 다음 페이지 진행 차단 및 모달 표출
  function NextPageBtn() {
    if (isCoverAnimPlaying) return;

    if (isPreviewMode.value && UserViewPage >= 4) {
      showBuyGuideModal = true;
      return;
    }

    switch (LookCoverStatus) {
      case "idle":
        if (CurrentViewPage == 0) idle_zoom_act();
        break;
      case "back":
        back_cover_act();
        break;
    }
    NextPage();
  }

  async function ChooseBtn() {
    if (isCoverAnimPlaying || isRunPageAnimating) return;
    isCoverAnimPlaying = true;
    if (LookCoverStatus == "back")
      await playAnimation(EmptyPageObj, "lookCoverBack", {
        onFinished: () => {
          isCoverAnimPlaying = false;
        },
        reverse: true,
      });

    if (LookCoverStatus != "idle") {
      animateFOV(threeContext.camera, 22.89);

      for (let i = 0, j = AllPages.length; i < j; i++) {
        const page = AllPages[i].page;
        const front = page.getObjectByName("Plane");
        const back = page.getObjectByName("Plane_1");
        animateEmissive(front, 0, 1500);
        animateEmissive(back, 0, 1500);
      }
      if (AllPages[0].video) {
      } else
        LoadCurrentThumbnail(AllPages[0].page, 0, {
          isEmission: true,
          isFront: true,
          isOriginal: true,
        });
      playAnimation(EmptyPageObj, "zoomCover", {
        onFinished: () => {
          isCoverAnimPlaying = false;
        },
        reverse: true,
      });
      LookCoverStatus = "idle";
    }
    const closeBook = async () => {
      for (let i = 0, j = CurrentViewPage; i < j; i++) {
        PrevPage(true);
        await new Promise((done) => setTimeout(done, 70));
      }
      UserViewPage = 0;
      await new Promise((done) => setTimeout(done, 1000));
      isCoverAnimPlaying = false;
    };
    MakeThumbnailPageCurrent();
    closeBook();
    toggleMove(threeContext.scene?.getObjectByName("page_center"), false);
  }

  // --------------------------------------------------------------------------
  // 🌟 [핵심 보안 & 초경량 로더 파이프라인]
  // --------------------------------------------------------------------------

  /** 도서 고유 복호화 시크릿 키 유도 (클라이언트 세션 한정) */
  function getBookSecretKey(bookId: string): string {
    return `OOB_KEY_${bookId}_2026_EPHEMERAL`;
  }

  /**
   * IndexedDB에는 암호화 버퍼만 저장하고, 메모리에서 복호화 후 128px 썸네일을 즉시 추출
   */
  async function LoadEpubSecurely(info: BookInfo) {
    const actId = "loadEpub";
    toastManager.upsertToast({ id: actId, message: "전자책 보안 검증 중..." });

    const secretKey = getBookSecretKey(info.id);

    try {
      // 🌟 맛보기 모드와 정식 구매본의 캐시 키 분리 (맛보기 파일이 정식본 캐시를 덮어쓰지 않도록 방어)
      const bookCacheKey = isPreviewMode.value ? `${info.id}_preview` : info.id;
      let encrypted = await indexed.loadEncryptedBook(bookCacheKey);

      if (!encrypted) {
        toastManager.upsertToast({
          id: actId,
          message: "도서 데이터 다운로드 중...",
        });

        const targetPath =
          isPreviewMode.value && info.preview_epub_url
            ? info.preview_epub_url
            : info.epub_url;

        const res = await fetch(getAssetUrl(targetPath));
        if (!res.ok) throw new Error("도서 다운로드 실패");
        const rawBuffer = await res.arrayBuffer();

        encrypted = await encryptBuffer(rawBuffer, secretKey);
        await indexed.saveEncryptedBook(bookCacheKey, encrypted);
      }

      // 2. RAM 메모리 상에서만 즉석 복호화
      toastManager.upsertToast({
        id: actId,
        message: "메모리 보안 해제 및 썸네일 준비 중...",
      });
      const decrypted = await decryptBuffer(encrypted, secretKey);
      inMemoryZip = await JSZip.loadAsync(decrypted);

      // 전체 원본 페이지 경로 수집 (물리적 양면 책자 보존)
      PagePaths = getSortedImagePaths(inMemoryZip);

      // 3. 🌟 128px 초경량 썸네일을 RAM에만 생성 (디스크 저장 X, 고속 넘김 100% 지원)
      inMemoryThumbnails.forEach((t) => t.dispose());
      inMemoryThumbnails = new Array(PagePaths.length);

      for (let i = 0, len = PagePaths.length; i < len; i++) {
        // 맛보기 상태이고 5페이지 이후라면 생성 자체를 건너뜀 (완전 빈 페이지로 바인딩)
        if (isPreviewMode.value && i >= 5) continue;

        const blob = await getImageBlob(inMemoryZip, PagePaths[i]);

        // 브라우저 하드웨어 가속 리사이징: 128px 초경량 비트맵 생성 (장당 10KB 미만)
        const thumbBitmap = await createImageBitmap(blob, {
          resizeWidth: 128,
          resizeQuality: "low",
        });

        // 첫 페이지에서 종횡비 측정
        if (i === 0) {
          PageSize.x = thumbBitmap.width * (2000 / 128);
          PageSize.y = thumbBitmap.height * (2000 / 128);
        }

        const thumbTexture = new THREE.Texture(thumbBitmap);
        thumbTexture.flipY = false;
        thumbTexture.colorSpace = THREE.SRGBColorSpace;
        thumbTexture.needsUpdate = true;

        inMemoryThumbnails[i] = thumbTexture;
      }

      // 4. 3D 페이지 오브젝트 생성
      await CreatePageObject({ videoCover: info.video_thumbnail });
      isEPubLoaded = true;
    } catch (err) {
      console.error("보안 도서 로딩 실패:", err);
      toastManager.upsertToast({
        id: actId,
        message: "도서 열람 준비 중 오류 발생",
      });
    }
  }

  /**
   * 🌟 온디맨드 고해상도(2000px+) 스왑: 멈춰 서서 읽는 페이지만 원본 추출
   */
  async function loadHighResTexture(
    pageIdx: number,
  ): Promise<THREE.Texture | null> {
    if (!inMemoryZip || !PagePaths || !PagePaths[pageIdx]) return null;
    if (isPreviewMode.value && pageIdx >= 5) return null; // 맛보기 제한

    const cacheKey = `p_${pageIdx}`;
    if (highResTextures.has(cacheKey)) {
      return highResTextures.get(cacheKey)!;
    }

    try {
      const blob = await getImageBlob(inMemoryZip, PagePaths[pageIdx]);
      // 2000px+ 원본 크기 그대로 비트맵 생성
      const fullBitmap = await createImageBitmap(blob);
      const texture = new THREE.Texture(fullBitmap);
      texture.flipY = false;
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.needsUpdate = true;

      highResTextures.set(cacheKey, texture);
      return texture;
    } catch {
      return null;
    }
  }

  /** 지나간 페이지의 고해상도 텍스처 메모리 즉시 회수 (VRAM 낭비 0%) */
  function clearHighResCache(keepIndices: number[] = []) {
    const keepKeys = keepIndices.map((i) => `p_${i}`);
    for (const [key, texture] of highResTextures.entries()) {
      if (!keepKeys.includes(key)) {
        texture.dispose();
        highResTextures.delete(key);
      }
    }
  }

  function getSortedImagePaths(zip: JSZip): string[] {
    return Object.keys(zip.files)
      .filter(
        (path) => !zip.files[path].dir && /\.(jpg|jpeg|png|webp)$/i.test(path),
      )
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }

  async function getImageBlob(zip: JSZip, path: string): Promise<Blob> {
    const file = zip.file(path);
    if (!file) throw new Error(`파일 누락: ${path}`);
    return await file.async("blob");
  }

  let isEPubLoaded = $state(false);
  function LoadEpubFromURL(info: BookInfo) {
    LoadEpubSecurely(info);
  }

  // --------------------------------------------------------------------------
  // 3D 페이지 오브젝트 구성 및 텍스처 바인딩
  // --------------------------------------------------------------------------
  async function CreatePageObject(options?: { videoCover?: string }) {
    AllPages.length = 0;

    let pageCenter = threeContext.scene?.getObjectByName("page_center");
    if (!pageCenter) {
      const book_model = threeContext.book_model.scene.clone();
      book_model.name = "book_model";
      threeContext.scene.add(book_model);
      pageCenter = threeContext.scene?.getObjectByName("page_center");
    }

    applyEmptyTransform(pageCenter, EmptyPageObj);
    const cover_center = threeContext.scene?.getObjectByName("cover_center");
    const ratio = 7500;
    pageCenter.scale.set(PageSize.x / ratio, 1, PageSize.y / ratio);
    let childCache: any;
    pageCenter.children.forEach((child: any) => {
      child.position.multiply(pageCenter.scale);
      childCache = child;
    });
    pageCenter.scale.set(1, 1, 1);
    PageDistance = getObjectDistanceData(pageCenter, childCache).distance * 2;

    const PageRoot = threeContext.page?.getObjectByName("PageRoot");
    const scaleX = PageSize.x / ratio;
    const scaleZ = PageSize.y / ratio;

    // 앞표지 단면
    {
      const pageRoot = PageRoot.clone(true);
      const PageObj = pageRoot.getObjectByName("Page");
      PageObj.castShadow = true;
      PageObj.receiveShadow = false;
      PageObj.traverse((obj) => {
        if (obj.isMesh) {
          obj.material = obj.material.clone();
          obj.geometry.computeBoundingBox();
          if (obj.geometry.morphAttributes.position) {
            const morphPositions = obj.geometry.morphAttributes.position;
            morphPositions.forEach((attr) => {
              for (let i = 0; i < attr.count; i++) {
                attr.setY(i, attr.getY(i) * scaleZ);
              }
            });
            obj.geometry.attributes.position.needsUpdate = true;
          }
        }
      });
      PageObj.scale.set(scaleX, 1, scaleZ);
      applyEmptyTransform(pageRoot, cover_center);
      try {
        if (!options?.videoCover) throw "비디오 없음";
        await CreateVideoTexTag(PageObj, options.videoCover);
      } catch (e) {
        await LoadCurrentThumbnail(PageObj, 0, { isOriginal: true });
      }

      const offset = (PagePaths.length - 1) / 2;
      pageRoot.position.set(0, offset * PAGE_THICKNESS, 0);
      PageObj.name = `Page_0`;
      pageRoot.userData.baseY = pageRoot.position.y;
      AllPages.push({
        root: pageRoot,
        page: PageObj,
        video: Boolean(options?.videoCover),
      });
    }

    const pageSet = singlePageForm ? 1 : 2;
    // 본문 양면 (모든 페이지에 128px 초경량 썸네일 기본 매핑)
    for (let i = 1, j = PagePaths.length - 2; i < j; i += pageSet) {
      const pageRoot = PageRoot.clone(true);
      const PageObj = pageRoot.getObjectByName("Page");
      PageObj.castShadow = true;
      PageObj.receiveShadow = false;
      PageObj.traverse((obj) => {
        if (obj.isMesh) {
          obj.material = obj.material.clone();
          obj.geometry.computeBoundingBox();
          if (obj.geometry.morphAttributes.position) {
            const morphPositions = obj.geometry.morphAttributes.position;
            morphPositions.forEach((attr) => {
              for (let i = 0; i < attr.count; i++) {
                attr.setY(i, attr.getY(i) * scaleZ);
              }
            });
            obj.geometry.attributes.position.needsUpdate = true;
          }
        }
      });
      PageObj.scale.set(scaleX, 1, scaleZ);
      applyEmptyTransform(pageRoot, cover_center);
      await LoadCurrentThumbnail(PageObj, i);
      if (!singlePageForm) {
        await LoadCurrentThumbnail(PageObj, i + 1, { isFront: false });
      }

      const offset = (j - 1) / 2 - i;
      pageRoot.position.set(0, offset * PAGE_THICKNESS, 0);
      PageObj.name = `Page_${Math.round(i / 2)}`;
      pageRoot.userData.baseY = pageRoot.position.y;
      AllPages.push({ root: pageRoot, page: PageObj });
    }

    // 뒷표지 단면
    {
      const pageRoot = PageRoot.clone(true);
      const PageObj = pageRoot.getObjectByName("Page");
      PageObj.castShadow = true;
      PageObj.receiveShadow = false;
      PageObj.traverse((obj) => {
        if (obj.isMesh) {
          obj.material = obj.material.clone();
          obj.geometry.computeBoundingBox();
          if (obj.geometry.morphAttributes.position) {
            const morphPositions = obj.geometry.morphAttributes.position;
            morphPositions.forEach((attr) => {
              for (let i = 0; i < attr.count; i++) {
                attr.setY(i, attr.getY(i) * scaleZ);
              }
            });
            obj.geometry.attributes.position.needsUpdate = true;
          }
        }
      });
      PageObj.scale.set(scaleX, 1, scaleZ);
      applyEmptyTransform(pageRoot, cover_center);
      await LoadCurrentThumbnail(PageObj, PagePaths.length - 1, {
        isFront: false,
      });

      const offset = -(PagePaths.length - 1) / 2;
      pageRoot.position.set(0, offset * PAGE_THICKNESS, 0);
      PageObj.name = `Page_${Math.round((PagePaths.length - 1) / 2)}`;
      pageRoot.userData.baseY = pageRoot.position.y;
      AllPages.push({ root: pageRoot, page: PageObj });
    }

    playAnimation(EmptyPageObj, "BookShow", {
      onFinished: () => {
        isCoverAnimPlaying = false;
      },
    });
    await new Promise(requestAnimationFrame);
  }

  function animateEmissive(obj: any, target: number, duration = 500) {
    cancelAnimationFrame(obj._raf);
    const start = obj.material.emissiveIntensity;
    const startTime = performance.now();

    const update = (now: number) => {
      const t = Math.min((now - startTime) / duration, 1);
      const eased = easeInOutSine(t);
      obj.material.emissiveIntensity = start + (target - start) * eased;
      if (t < 1) obj._raf = requestAnimationFrame(update);
    };

    obj._raf = requestAnimationFrame(update);
  }

  /**
   * 🌟 128px 초경량 썸네일 투사 및 현재 읽는 페이지 고화질 스왑 연동
   */
  async function LoadCurrentThumbnail(
    obj: any,
    i: number,
    {
      isEmission = false,
      isOriginal = false,
      isFront = true,
      isBlank = false,
    } = {},
  ) {
    if (!obj) return;
    const targetObj = obj.getObjectByName(isFront ? "Plane" : "Plane_1");

    // 맛보기 모드에서 5페이지 이후는 완전 백색 텍스처로 강제
    if (isPreviewMode.value && i >= 5) {
      isBlank = true;
    }

    let texture: THREE.Texture;

    if (isBlank) {
      const data = new Uint8Array([255, 255, 255, 255]);
      texture = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
      texture.needsUpdate = true;
    } else if (isOriginal) {
      // 🌟 현재 읽고 있는 페이지: 고해상도(2000px+) 텍스처 온디맨드 로드
      const highRes = await loadHighResTexture(i);
      texture = highRes || inMemoryThumbnails[i];
    } else {
      // 🌟 넘김 연출("촤라락") 및 배경 상태: RAM에 캐시된 128px 초경량 썸네일 사용
      texture = inMemoryThumbnails[i];
    }

    if (!texture) return;

    targetObj.material.map = texture;

    if (isEmission) {
      targetObj.material.emissive = new THREE.Color(0xffffff);
      targetObj.material.emissiveMap = texture;
      if (targetObj.material.emissiveIntensity < 1) {
        animateEmissive(targetObj, 1);
      }
    } else if (targetObj.material.emissiveIntensity > 0) {
      animateEmissive(targetObj, 0);
    }
    targetObj.material.needsUpdate = true;
  }

  function disposeObject3D(
    root: any,
    options: {
      keepRoot?: boolean;
      excludeNames?: string[];
      skipDisposeNames?: string[];
    } = {},
  ) {
    if (!root) return;
    const keepRoot = options.keepRoot ?? false;
    const excludeNames = options.excludeNames ?? [];
    const skipDisposeNames = options.skipDisposeNames ?? [];
    const isExcluded = (obj: any) => excludeNames.includes(obj.name);
    const shouldSkipDispose = (obj: any) => skipDisposeNames.includes(obj.name);

    root.traverse((obj: any) => {
      if (keepRoot && obj === root) return;
      if (isExcluded(obj)) return;
      if (obj.geometry && !shouldSkipDispose(obj)) {
        obj.geometry.dispose();
      }
      if (obj.material && !shouldSkipDispose(obj)) {
        const disposeMaterial = (material: any) => {
          for (const key in material) {
            const value = material[key];
            if (value && value.isTexture) value.dispose();
          }
          material.dispose();
        };

        if (Array.isArray(obj.material)) {
          obj.material.forEach(disposeMaterial);
        } else {
          disposeMaterial(obj.material);
        }
      }
    });

    if (!keepRoot) {
      if (root.parent) root.parent.remove(root);
    } else {
      const childrenToRemove = root.children.filter((child: any) => {
        if (excludeNames.includes(child.name)) return false;
        return true;
      });
      childrenToRemove.forEach((child: any) => {
        root.remove(child);
      });
    }
  }

  async function ClearIndexedDB() {
    // 낱개 파일 제거 대신 세션 종료 시 암호화 캐시를 필요에 따라 정리
  }

  function WriteProgressBook() {
    if (isPreviewMode.value) return;

    if (CurrentBookInfo && LookCoverStatus != "idle") {
      CurrentBookInfo["user_read"] = UserViewPage;
      CurrentBookInfo["progress"] = Math.max(
        CurrentBookInfo["progress"] || 0,
        Math.floor(((UserViewPage + 1) / PagePaths.length) * 100),
      );
    }
  }

  /** 다음 페이지 보기 */
  function NextPage(force?: boolean) {
    // 🌟 맛보기 모드: 5페이지(인덱스 4) 도달 시 다음 장 진행 차단 및 모달 표출
    if (isPreviewMode.value && !force && UserViewPage >= 4) {
      showBuyGuideModal = true;
      return;
    }

    if (CurrentViewPage < AllPages.length) {
      targetBloom = 0;
      if (singlePageForm || force) {
        const PageObj = AllPages[CurrentViewPage].page;
        playPageAnimation(PageObj, "PlaneAction");
        for (let i = 0, j = AllPages.length; i < j; i++) {
          if (i < CurrentViewPage) {
            const revPage = AllPages[CurrentViewPage - i];
            AllPages[i].root.position.y = revPage.root.userData.baseY;
          } else {
            const prevPage = AllPages[i - CurrentViewPage];
            AllPages[i].root.position.y = prevPage.root.userData.baseY;
          }
        }
        const current = CurrentViewPage;
        CurrentViewPage++;
        UserViewPage++;
        if (CurrentViewPage < AllPages.length) {
          LoadCurrentThumbnail(
            AllPages[CurrentViewPage].page,
            CurrentViewPage,
            {
              isEmission: true,
              isFront: true,
              isOriginal: true,
            },
          );
          LoadCurrentThumbnail(AllPages[current].page, current, {
            isEmission: true,
            isFront: false,
            isBlank: true,
          });
        } else {
          toggleMove(threeContext.scene?.getObjectByName("page_center"), true);
          LoadCurrentThumbnail(AllPages[current].page, CurrentViewPage, {
            isEmission: true,
            isFront: false,
            isOriginal: true,
          });
        }
        setTimeout(() => {
          if (!AllPages[current].video && current != CurrentViewPage)
            LoadCurrentThumbnail(AllPages[current].page, current, {
              isEmission: true,
              isFront: true,
              isOriginal: false,
            });
        }, 1000);
      } else {
        if (CurrentViewPage == 0) isMoved = true;
        if (CurrentViewPage == AllPages.length - 1) isMoved = false;

        if (isMoved && CurrentViewPage != 0) {
          toggleMove(threeContext.scene?.getObjectByName("page_center"));
          UserViewPage++;
        } else {
          const PageObj = AllPages[CurrentViewPage].page;
          playPageAnimation(PageObj, "PlaneAction");
          toggleMove(threeContext.scene?.getObjectByName("page_center"));
          for (let i = 0, j = AllPages.length; i < j; i++) {
            if (i < CurrentViewPage) {
              const revPage = AllPages[CurrentViewPage - i];
              AllPages[i].root.position.y = revPage.root.userData.baseY;
            } else {
              const prevPage = AllPages[i - CurrentViewPage];
              AllPages[i].root.position.y = prevPage.root.userData.baseY;
            }
          }
          const prev = CurrentViewPage - 1;
          const current = CurrentViewPage;
          CurrentViewPage++;
          UserViewPage++;

          if (CurrentViewPage == 1) {
            LoadCurrentThumbnail(AllPages[current].page, current, {
              isEmission: true,
              isFront: false,
              isBlank: true,
            });
            LoadCurrentThumbnail(
              AllPages[CurrentViewPage].page,
              current * 2 + 1,
              {
                isEmission: true,
                isFront: true,
                isOriginal: true,
              },
            );
          } else if (CurrentViewPage < AllPages.length) {
            LoadCurrentThumbnail(AllPages[current].page, current * 2, {
              isEmission: true,
              isFront: false,
              isOriginal: true,
            });
            const checkLast = AllPages.length - 1 == CurrentViewPage;
            LoadCurrentThumbnail(
              AllPages[CurrentViewPage].page,
              current * 2 + 1,
              {
                isEmission: true,
                isFront: true,
                isOriginal: checkLast ? undefined : true,
                isBlank: checkLast ? true : undefined,
              },
            );
            if (checkLast) isMoved = false;
          } else {
            LoadCurrentThumbnail(AllPages[current].page, PagePaths.length - 1, {
              isEmission: true,
              isFront: false,
              isOriginal: true,
            });
          }

          // 지나간 고화질 텍스처 정리 및 메모리 회수
          clearHighResCache([current * 2, current * 2 + 1]);

          setTimeout(() => {
            if (current == CurrentViewPage) return;
            if (current == 0) {
              if (!AllPages[current].video)
                LoadCurrentThumbnail(AllPages[current].page, current, {
                  isEmission: true,
                  isFront: true,
                  isOriginal: false,
                });
            } else if (current < AllPages.length - 1) {
              if (prev != 0)
                LoadCurrentThumbnail(AllPages[prev].page, prev * 2, {
                  isEmission: true,
                  isFront: false,
                  isOriginal: false,
                });
              const checkLast = AllPages.length - 1 == current;
              if (!checkLast)
                LoadCurrentThumbnail(AllPages[current].page, prev * 2 + 1, {
                  isEmission: true,
                  isFront: true,
                  isOriginal: false,
                });
            } else {
              LoadCurrentThumbnail(AllPages[prev].page, PagePaths.length - 2, {
                isEmission: true,
                isFront: false,
                isOriginal: false,
              });
            }
          }, 1000);
        }
      }
      WriteProgressBook();
    }
  }

  /** 이전 페이지 보기 */
  function PrevPage(force?: boolean) {
    if (CurrentViewPage > 0) {
      targetBloom = 0;
      if (singlePageForm || force) {
        const prev = CurrentViewPage - 1;
        const current = CurrentViewPage;
        if (!force) {
          if (!AllPages[prev].video)
            LoadCurrentThumbnail(AllPages[prev].page, prev, {
              isEmission: true,
              isFront: true,
              isOriginal: true,
            });
          if (current < AllPages.length) {
            setTimeout(() => {
              LoadCurrentThumbnail(AllPages[current].page, current, {
                isEmission: true,
                isFront: true,
                isOriginal: false,
              });
            }, 1000);
          } else {
            toggleMove(
              threeContext.scene?.getObjectByName("page_center"),
              false,
            );
            setTimeout(() => {
              if (current == CurrentViewPage) return;
              LoadCurrentThumbnail(AllPages[prev].page, current, {
                isEmission: true,
                isFront: false,
                isOriginal: false,
              });
            }, 1000);
          }
        }
        CurrentViewPage--;
        UserViewPage--;
        const PageObj = AllPages[CurrentViewPage].page;
        playPageAnimation(PageObj, "PlaneAction", true);
        for (let i = 0, j = AllPages.length; i < j; i++) {
          if (i < CurrentViewPage) {
            const revPage = AllPages[CurrentViewPage - i];
            AllPages[i].root.position.y = revPage.root.userData.baseY;
          } else {
            const prevPage = AllPages[i - CurrentViewPage];
            AllPages[i].root.position.y = prevPage.root.userData.baseY;
          }
        }
      } else {
        if (CurrentViewPage == 1 || UserViewPage == PagePaths.length - 2)
          isMoved = true;

        if (!isMoved && CurrentViewPage != AllPages.length - 1) {
          toggleMove(threeContext.scene?.getObjectByName("page_center"));
          UserViewPage--;
        } else {
          const prev = CurrentViewPage;
          CurrentViewPage--;
          UserViewPage--;
          const current = CurrentViewPage;
          const next = CurrentViewPage - 1;

          const PageObj = AllPages[CurrentViewPage].page;
          if (prev == AllPages.length) isMoved = false;
          playPageAnimation(PageObj, "PlaneAction", true);
          toggleMove(threeContext.scene?.getObjectByName("page_center"));
          for (let i = 0, j = AllPages.length; i < j; i++) {
            if (i < CurrentViewPage) {
              const revPage = AllPages[CurrentViewPage - i];
              AllPages[i].root.position.y = revPage.root.userData.baseY;
            } else {
              const prevPage = AllPages[i - CurrentViewPage];
              AllPages[i].root.position.y = prevPage.root.userData.baseY;
            }
          }

          if (CurrentViewPage == 0) {
            if (!AllPages[CurrentViewPage].video)
              LoadCurrentThumbnail(
                AllPages[CurrentViewPage].page,
                CurrentViewPage,
                {
                  isEmission: true,
                  isFront: true,
                  isOriginal: true,
                },
              );
          } else if (CurrentViewPage < AllPages.length) {
            if (next > 0)
              LoadCurrentThumbnail(AllPages[next].page, next * 2, {
                isEmission: true,
                isFront: false,
                isOriginal: true,
              });
            if (CurrentViewPage != AllPages.length - 1)
              LoadCurrentThumbnail(
                AllPages[CurrentViewPage].page,
                next * 2 + 1,
                {
                  isEmission: true,
                  isFront: true,
                  isOriginal: true,
                },
              );
          } else {
            LoadCurrentThumbnail(AllPages[next].page, PagePaths.length - 1, {
              isEmission: true,
              isFront: false,
              isOriginal: true,
            });
          }

          clearHighResCache([next * 2, next * 2 + 1]);

          setTimeout(() => {
            if (prev == CurrentViewPage) return;
            if (current == 0) {
              LoadCurrentThumbnail(AllPages[prev].page, prev, {
                isEmission: true,
                isFront: true,
                isOriginal: false,
              });
            } else if (current < AllPages.length - 1) {
              if (next > 0)
                LoadCurrentThumbnail(AllPages[current].page, current * 2, {
                  isEmission: true,
                  isFront: false,
                  isOriginal: false,
                });
              if (prev != AllPages.length - 1)
                LoadCurrentThumbnail(AllPages[prev].page, current * 2 + 1, {
                  isEmission: true,
                  isFront: true,
                  isOriginal: false,
                });
            } else {
              LoadCurrentThumbnail(
                AllPages[current].page,
                PagePaths.length - 1,
                {
                  isEmission: true,
                  isFront: false,
                  isOriginal: false,
                },
              );
            }
          }, 1000);
        }
      }
      WriteProgressBook();
    }
  }

  let isMoved = false;
  let moveAnimation = undefined as {
    object: THREE.Object3D;
    from: THREE.Vector3;
    to: THREE.Vector3;
    duration: number;
    elapsed: number;
  };
  let PageDistance = 0;
  function toggleMove(object: THREE.Object3D, force?: boolean) {
    isMoved = force ?? !isMoved;
    const duration: number = 1;
    const from = object.position.clone();
    const to = isMoved
      ? new THREE.Vector3(PageDistance, from.y, from.z)
      : new THREE.Vector3(0, from.y, from.z);

    moveAnimation = {
      object,
      from,
      to,
      duration,
      elapsed: 0,
    };
  }

  function easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function updateMoveAnimation(delta: number) {
    if (!moveAnimation) return;
    const anim = moveAnimation;
    anim.elapsed += delta;
    let t = anim.elapsed / anim.duration;
    if (t > 1) t = 1;
    const eased = easeInOutCubic(t);
    anim.object.position.lerpVectors(anim.from, anim.to, eased);
    if (t >= 1) {
      moveAnimation = undefined;
    }
  }

  let tempVecA = new THREE.Vector3();
  let tempVecB = new THREE.Vector3();
  let tempDir = new THREE.Vector3();

  function getObjectDistanceData(a: THREE.Object3D, b: THREE.Object3D) {
    a.getWorldPosition(tempVecA);
    b.getWorldPosition(tempVecB);
    const distance = tempVecA.distanceTo(tempVecB);
    const direction = tempDir.subVectors(tempVecB, tempVecA).normalize();
    return { distance, direction };
  }

  let isPageNumberClicked = $state(false);
  let isRunPageAnimating = false;

  async function UserWantInputPageNumber() {
    if (isRunPageAnimating) return;
    await new Promise(requestAnimationFrame);
    isPageNumberClicked = !isPageNumberClicked;
    if (isPageNumberClicked) {
      requestAnimationFrame(() => {
        document.getElementById("UserInputPage").focus();
      });
    } else {
      isRunPageAnimating = true;
      const CurrentPage = UserViewPage || CurrentViewPage;
      const inputValue = document.getElementById("UserInputPage")["value"];
      let userInputPage = inputValue ? Number(inputValue) - 1 : CurrentPage;

      // 🌟 맛보기 모드: 5페이지(인덱스 4)를 초과하는 번호 입력 시 차단 및 구매 유도 모달 표출
      if (isPreviewMode.value && userInputPage >= 4) {
        showBuyGuideModal = true;
        userInputPage = Math.min(4, userInputPage);
      }

      const filtered = Math.min(
        PagePaths.length - 1,
        Math.max(0, userInputPage),
      );
      const diff = filtered - CurrentPage;
      const abs_diff = Math.abs(diff);
      const isPositive = diff > 0;

      // 🌟 촤라락 넘김 연출: 128px 초경량 썸네일로 가볍고 빠른 잔상 플립 보장
      const PageAnim = async () => {
        if (abs_diff) {
          if (LookCoverStatus == "idle") idle_zoom_act();
          if (LookCoverStatus == "back") back_cover_act();
        }
        for (let i = 0; i < abs_diff; i++) {
          if (isPositive) {
            NextPage();
          } else {
            PrevPage();
          }
          await new Promise((done) => setTimeout(done, 70));
        }
        isRunPageAnimating = false;
      };
      PageAnim();
      document.getElementById("UserInputPage")["value"] = null;
    }
  }

  onDestroy(() => {
    // RAM 상의 텍스처 및 비트맵 완전 회수
    inMemoryThumbnails.forEach((t) => t.dispose());
    inMemoryThumbnails = [];
    highResTextures.forEach((t) => t.dispose());
    highResTextures.clear();
    inMemoryZip = null;

    const keys = Object.keys(threeContext || {});
    for (let key of keys) {
      switch (key) {
        case "container":
          threeContext[key].remove();
          break;
        case "renderer":
          threeContext[key].dispose();
          threeContext[key].forceContextLoss();
          threeContext[key].domElement.remove();
          break;
        case "env":
        case "book_model":
          disposeObject3D(threeContext[key].scene);
          break;
        default:
          disposeObject3D(threeContext[key]);
          break;
      }
      threeContext[key] = null;
    }
    threeContext = null;
  });
</script>

<div
  id="viewer"
  style="
        width: 100%;
        height: 100%;
        background-color: black;
        position: relative;
        overflow: hidden;
    "
>
  {#if isEPubLoaded}
    <button
      onclick={UserWantInputPageNumber}
      class="element-button"
      style="
                position: absolute;
                right: 0;
                top: 0;
                margin: 16px;
                font-size: 32px;
                cursor: pointer;
                color: white;
                display: flex;
                align-items: center;
                gap: 8px;
            "
    >
      {#if isPreviewMode.value}
        <span
          style="
            font-size: 13px;
            font-weight: 700;
            background: #ff9f0a;
            color: black;
            padding: 4px 8px;
            border-radius: 6px;
          "
        >
          맛보기
        </span>
      {/if}

      {#if !isPageNumberClicked}
        <span>
          {(UserViewPage || 0) + 1}
        </span>
      {:else}
        <span>
          <input
            id="UserInputPage"
            type="number"
            placeholder={`${(UserViewPage || 0) + 1}`}
            style="
              width: 100px;
              height: 40px;
              text-align: right;
              font-size: 32px;
              margin: 0;
              padding: 0;
              border: none;
              outline: none;
              box-sizing: border-box;
              background-color: transparent;
              color: white;
            "
            onblur={UserWantInputPageNumber}
            onkeydown={(e) => {
              if (e.key === "Enter") {
                UserWantInputPageNumber();
              }
            }}
          />
        </span>
      {/if}

      <span
        style="
          pointer-events: none;
          user-select: none;
        "
      >
        | {PagePaths?.length || 0}
      </span>
    </button>
  {/if}

  {#if isReadingMode.value && isEPubLoaded}
    <div
      class="center_contents button_panel"
      style="pointer-events: auto;"
      transition:fly={{ y: 50 }}
    >
      {#if isEPubLoaded && UserViewPage === 0}
        <button
          transition:button_anim
          class="button_style"
          onclick={showFrontCover}>표지</button
        >
      {/if}

      {#if isEPubLoaded && UserViewPage}
        <button
          transition:button_anim
          class="button_style"
          onclick={() => PrevPage()}>이전</button
        >
      {/if}

      {#if isEPubLoaded && LookCoverStatus != "idle"}
        <button
          transition:button_anim
          class="button_style"
          onclick={NextPageBtn}>다음</button
        >
      {/if}
    </div>
  {/if}

  <!-- 🌟 z-index 없는 자연스러운 DOM 순서 모달 팝업 -->
  {#if showBuyGuideModal}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="guide-modal-backdrop"
      transition:fade={{ duration: 150 }}
      onclick={() => (showBuyGuideModal = false)}
    >
      <div
        class="guide-modal-card"
        transition:scale={{ start: 0.95, duration: 180 }}
        onclick={(e) => e.stopPropagation()}
      >
        <div class="guide-icon">📖</div>
        <h3>5페이지 미리보기가 종료되었습니다</h3>
        <p>
          준비된 맛보기 페이지를 모두 감상하셨습니다.<br />
          전체 내용을 이어서 읽으시려면 도서를 구매해 주세요.
        </p>

        <div class="guide-btn-row">
          <button
            class="guide-btn-close"
            onclick={() => (showBuyGuideModal = false)}
          >
            닫기
          </button>
          <button
            class="guide-btn-buy"
            onclick={() => {
              showBuyGuideModal = false;
              OpenBookList();
              TransferAct["BuyBook"]?.(CurrentBookInfo);
            }}
          >
            {CurrentBookInfo?.price
              ? `${CurrentBookInfo.price.toLocaleString()}원에 구매하기`
              : "전체 도서 구매하기"}
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  input[type="number"] {
    -moz-appearance: textfield;
    appearance: textfield;
  }

  input[type="number"]::-webkit-outer-spin-button,
  input[type="number"]::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  .center_contents {
    display: flex;
    justify-content: center;
    align-items: center;
    position: absolute;
    bottom: 32px;
    left: 50%;
    transform: translateX(-50%);
  }

  .button_panel {
    flex-direction: row;
    gap: 0px;
    background-color: #fff8;
    backdrop-filter: blur(2px);
    border-radius: 16px;
    padding: 16px 16px 16px 0px;
  }

  .button_style {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 64px;
    height: 64px;
    user-select: none;
    border-radius: 8px;
    border: 3px double var(--threejs-button-border);
    background-color: var(--threejs-button);
    margin-left: 16px;
    cursor: pointer;
    padding: 0px;
    font-size: 16px;
  }

  /* 🌟 z-index 없는 모달 레이어 */
  .guide-modal-backdrop {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    justify-content: center;
    align-items: center;
    backdrop-filter: blur(6px);
  }

  .guide-modal-card {
    width: 90%;
    max-width: 400px;
    background: rgba(26, 26, 26, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 20px;
    padding: 30px 24px;
    text-align: center;
    color: #ffffff;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
  }

  .guide-icon {
    font-size: 36px;
    margin-bottom: 12px;
  }

  .guide-modal-card h3 {
    margin: 0 0 10px 0;
    font-size: 17px;
    font-weight: 700;
  }

  .guide-modal-card p {
    margin: 0 0 24px 0;
    font-size: 14px;
    line-height: 1.6;
    color: rgba(255, 255, 255, 0.65);
  }

  .guide-btn-row {
    display: flex;
    gap: 10px;
  }

  .guide-btn-close {
    flex: 1;
    padding: 12px;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
  }

  .guide-btn-buy {
    flex: 1.5;
    padding: 12px;
    border-radius: 10px;
    border: none;
    background: #0a84ff;
    color: #ffffff;
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
  }
</style>
