<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { goHome } from "../services/global";
  import { p5loading } from "../services/p5loading";
  import { indexed } from "../services/indexed";
  import { lang } from "../services/language";

  import * as THREE from "three";
  import * as ThreeGLTFLoader from "three/examples/jsm/loaders/GLTFLoader.js";

  import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
  import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
  import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

  import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

  import p5 from "p5";
  import JSZip from "jszip";
  import { cubicOut } from "svelte/easing";

  interface PageInfo {
    root: any;
    page: any;
    video?: boolean;
  }

  interface BookInfo {
    id: string;
    title: string;
    desc?: string;
    thumbnail: string;
    video_thumbnail?: string;
    epub_url: string;
    last_view?: number;
    purchase_time: number;
    author: string;
    user_read?: number;
    progress?: number;
  }

  onMount(() => {
    requestAnimationFrame(() => {
      const targetDiv = document.getElementById("viewer");
      initThreeWithGLB(targetDiv as HTMLDivElement).then(() => {
        LoadUIButtons();
        OpenBookList();
      });
    });
  });

  /** 이전 탭으로 돌아가기 */
  function GoBackHome() {
    goHome();
  }

  /** threejs 씬 구성됨 */
  let threeContext = null;
  /** 불러와진 썸네일 URL 기록, 나갈 때 전부 제거할 것 */
  let PagePaths: string[] = $state(undefined);
  /** Bloom 효과 적용 정도 */
  let targetBloom: number;
  /** 디버그용 컨트롤러 */
  let controls: any;
  /** 책을 읽고 있는지 여부 */
  let isReadingBook = false;
  /** 현재 바라보는 책 페이지 */
  let ViewPageTarget = null;
  /** 책의 크기를 기억함 */
  let boundingBox = {
    reinit: true,
    center: null,
    size: null,
  };
  /** 페이지의 실제 px 크기 */
  let PageSize = {
    x: 0,
    y: 0,
  };
  /** 페이지 empty 개체를 기억함 */
  let EmptyPageObj = null;
  /** 현재 보는 페이지 (시스템 기준으로) */
  let CurrentViewPage = 0;
  /** 사용자가 보는 페이지 (사용자 기준, 양면 페이지 뷰에 대한 추적용) */
  let UserViewPage = $state(0);
  /** 준비한 모든 페이지를 기억하고 향후 페이지 조정에 사용 */
  let AllPages: PageInfo[] = [];
  /** 페이지 두께 */
  let PAGE_THICKNESS = 0.001;
  /** 단면 페이지 구성으로 책을 불러올지 여부 */
  let singlePageForm = false;
  /** 표지 보기 상태에 따라 애니메이션 적용 */
  let LookCoverStatus = $state("idle");
  /** 내가 보유한 책 정보 */
  let BookList: BookInfo[] = $state([]);
  /** 선택된 책 정보를 기억 */
  let CurrentBookInfo: BookInfo;

  /** 책 목록 가져오기 (Modal) */
  async function OpenBookList() {
    // 테스트 정보 수집
    // 이 자리에 나중에 실제로 서버로부터 리스트 받기 행동이 필요함
    if (!BookList.length)
      BookList = [
        {
          id: "test_book_id_0",
          title: "바이블일러스트큐티",
          desc: "말풍선 글짓기 QT",
          thumbnail: "assets/thumbnail.jpg",
          video_thumbnail: "assets/vid_cover_sample.mp4",
          epub_url: "assets/00.epub",
          purchase_time: Date.now(),
          author: "최정훈",
          user_read: 0,
        },
      ];
    // 버튼을 누르면 책을 단상 위에 다시 올려둠
    await ChooseBtn();
    // 애니메이션이 종료되면 리스트 모달 띄우기
    BookListModal.showModal();
  }
  let BookListModal: any;
  let isClosing = $state(false);

  async function CloseModal() {
    isClosing = true;

    await new Promise((r) => setTimeout(r, 250));

    BookListModal.close();

    isClosing = false;
  }
  /** 마지막에 본 책 id를 기억해서 로딩 중복을 하지 않음 */
  let LastViewedBookId = $state("");
  /** 모달에서 책 정보를 클릭함 */
  async function ClickBookListFromModal(info: BookInfo) {
    // 모달은 닫기
    CloseModal();
    if (LastViewedBookId == info.id) return;
    CurrentBookInfo = info;
    // 이미 존재하는 책이 있다면 빼내기 애니메이션
    playAnimation(EmptyPageObj, "BookShow", {
      reverse: true,
      onFinished: () => {
        isCoverAnimPlaying = true;
        // 책 정보를 삭제
        disposeObject3D(EmptyPageObj, { keepRoot: true });
        const willRemove = threeContext.scene?.getObjectByName("book_model");
        disposeObject3D(willRemove);
        // 필요한 개체 재생성
        const book_model = threeContext.book_model.scene.clone();
        book_model.name = "book_model";
        threeContext.scene.add(book_model);
      },
    });
    // 새 책을 고르면 기존 책 정보 제거
    await ClearIndexedDB();
    // 선택한 책 불러오기
    LoadEpubFromURL(info);
  }
  /** threejs 환경을 생성함
   * 생성하는 과정에서 미리 준비된 가상 책 전시 환경을 가져옴
   */
  async function initThreeWithGLB(container: HTMLDivElement) {
    if (threeContext) return threeContext;

    const scene = new THREE.Scene();

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    const loader = new ThreeGLTFLoader.GLTFLoader();
    // 주소로부터 파일 가져오기
    /** 애니메이션이 포함된 환경 3d 모델 */
    const glbURL = "assets/model/env.glb";
    /** 페이지 구성 좌표계 모델 */
    const book = "assets/model/book.glb";
    const env = await loader.loadAsync(glbURL);
    const book_model = await loader.loadAsync(book);

    // const ambient = new THREE.AmbientLight(0xffffff, 0.3);
    // scene.add(ambient);

    // 🔥 GLB 전체 씬 추가
    scene.add(env.scene);

    // 🎯 카메라 가져오기
    let camera = null;

    if (env.cameras && env.cameras.length > 0) {
      camera = env.cameras[0];
    } else {
      // fallback
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

        boundingBox.center = {
          x: center.x,
          y: center.y,
        };
        boundingBox.size = {
          x: size.x,
          y: size.y,
        };

        boundingBox.reinit = false;
      }

      const aspect = camera.aspect;
      const vFov = THREE.MathUtils.degToRad(camera.fov);

      // 세로 기준 거리
      const distanceY = boundingBox.size.y / 2 / Math.tan(vFov / 2);

      // 가로 FOV
      const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);

      // 가로 기준 거리
      const distanceX = boundingBox.size.x / 2 / Math.tan(hFov / 2);

      const distance = Math.max(distanceX, distanceY) * offset;

      // 카메라 위치
      camera.position.set(
        boundingBox.center.x,
        boundingBox.center.y,
        boundingBox.center.z + distance,
      );
      // 중심 바라보기
      camera.lookAt(boundingBox.center);

      return boundingBox.center;
    };

    // 블룸(Bloom) 설정
    const composer = new EffectComposer(renderer);

    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(container.clientWidth / 2, container.clientHeight / 2),
      1.5, // strength
      0.4, // radius
      0.85, // threshold
    );

    composer.addPass(bloomPass);

    // 창 크기 변경시 카메라 정보 조정
    /** 창 크기가 변할 때마다 카메라가 왜곡되지 않도록 조정함 */
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
    setTimeout(() => {
      resizeCameraAspect();
    }, 1000);
    /** 페이지 개체 정보 */
    let page = null;
    // 페이지 개체 기억하기
    let removeTargets = [];
    book_model.scene.traverse((obj) => {
      // 개체 이름별로 설정 적용
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
    removeTargets.forEach((obj) => {
      obj.removeFromParent();
    });
    let updateParticles: Function;
    // 그림자 설정
    env.scene.traverse((obj) => {
      // 개체 이름별로 설정 적용
      switch (obj.name) {
        // 메인 스팟 조명
        case "main_spot":
          obj["intensity"] = 0;
          // 시작하게 되면 서서히 조명을 밝힘
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
        // 책이 배치되어야할 위치 지정
        case "bookPos":
          EmptyPageObj = obj;
          break;
        // 바닥 테이블
        case "bottom":
          obj.receiveShadow = true;
          // threejs 에서 static 개체와 유사하게 설정하여 업데이트 정보 최소화하기
          obj.matrixAutoUpdate = false;
          obj.castShadow = false;
          break;
        // 파티클 생성 위치
        case "particlePos":
          const spawnPosition = new THREE.Vector3();
          obj.getWorldPosition(spawnPosition);

          const COUNT = 30;

          const geometry = new THREE.BufferGeometry();

          const positions = new Float32Array(COUNT * 3);
          const velocities = new Float32Array(COUNT);
          const life = new Float32Array(COUNT);
          const sizes = new Float32Array(COUNT);

          const SPAWN_RADIUS = 0.4; // 생성 범위

          for (let i = 0; i < COUNT; i++) {
            positions[i * 3 + 0] =
              spawnPosition.x + (Math.random() - 0.5) * SPAWN_RADIUS;
            positions[i * 3 + 1] = spawnPosition.y;
            positions[i * 3 + 2] =
              spawnPosition.z + (Math.random() - 0.5) * SPAWN_RADIUS;

            velocities[i] = 0.001 + Math.random() * 0.002; // 더 느리게 (중요)

            life[i] = Math.random();

            const t = life[i]; // 0~1
            sizes[i] = 1.0 - t; // 1 → 0
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

              // ✔ scale 대신 “사실상 fade 느낌”
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

    // 🔁 렌더 루프
    const clock = new THREE.Timer();

    targetBloom = 0.025;
    let bloomStrength = 0.05;

    /** bloom 을 조정함 */
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
      mixers.forEach((mixer) => {
        mixer.update(delta);
      });
      updateMoveAnimation(delta);
      renderer.render(scene, camera);
      composer.render();
    };

    renderer.setAnimationLoop(animate);

    // context 저장
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

  /** 비디오 텍스처 사용 대비 태그 */
  let VideoTexTag: HTMLVideoElement;
  /** threejs 텍스처 개체 생성 */
  let VideoTexture: any;
  /** 비디오 텍스처를 사용하는 경우 비디오 태그 생성 관리 */
  async function CreateVideoTexTag(obj: any, path: string) {
    try {
      RemoveVideoElement();
      // 비디오 텍스처 대비 태그 생성
      let VideoTexTag = document.createElement("video");

      VideoTexTag.src = path;
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

  /** 비디오 개체 및 텍스처 삭제 */
  function RemoveVideoElement() {
    if (VideoTexTag) {
      VideoTexTag.pause();
      VideoTexTag.src = "";
      VideoTexTag.load();
      VideoTexTag.remove();
    }
    VideoTexture?.dispose();
  }

  /** 개체 애니메이션 재생하기 */
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

    // 애니메이션 클립 찾기
    const clip = THREE.AnimationClip.findByName(ctx.env.animations, clipName);
    // 대상 기준 mixer 생성
    const mixer = new THREE.AnimationMixer(target);

    // action 생성
    const action = mixer.clipAction(clip, target);

    await new Promise((done: any) => {
      if (!clip) {
        console.log("애니메이션 클립 누락:", clipName);
        return null;
      }

      // 기본 옵션
      const {
        loop = THREE.LoopOnce,
        repetitions = 1,
        clampWhenFinished = true,
        onFinished,
      } = options || {};

      // reset
      action.reset();

      // 역재생 여부
      action.timeScale = options?.reverse ? -1 : 1;

      // 시작 위치
      action.time = options?.reverse ? clip.duration : 0;

      // loop 설정
      action.setLoop(loop, repetitions);

      // 종료 시 마지막 프레임 유지 여부
      action.clampWhenFinished = clampWhenFinished;

      // 재생
      action.play();

      // mixer 등록
      mixers.push(mixer);

      // cleanup
      const finishedHandler = () => {
        mixers = mixers.filter((m) => m !== mixer);

        mixer.removeEventListener("finished", finishedHandler);

        onFinished?.();

        done();
      };

      mixer.addEventListener("finished", finishedHandler);
    });

    return {
      mixer,
      action,
      clip,
    };
  }

  /** 페이지 애니메이션 보간용 */
  let pageAnimationMap = new Map<
    THREE.Object3D,
    {
      mixer: THREE.AnimationMixer;
      rootAction: THREE.AnimationAction;
      pageAction: THREE.AnimationAction;
    }
  >();

  let mixers = [];
  /** key 를 기반으로 페이지 애니메이션을 재생함 */
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

    // 기존 상태 가져오기
    let state = pageAnimationMap.get(target);

    // 최초 생성
    if (!state) {
      const mixer = new THREE.AnimationMixer(parent);

      const rootAction = mixer.clipAction(rootClip, parent);
      const pageAction = mixer.clipAction(clip, target);

      rootAction.setLoop(THREE.LoopOnce, 1);
      pageAction.setLoop(THREE.LoopOnce, 1);

      rootAction.clampWhenFinished = true;
      pageAction.clampWhenFinished = true;

      mixers.push(mixer);

      state = {
        mixer,
        rootAction,
        pageAction,
      };

      pageAnimationMap.set(target, state);
    }

    const { rootAction, pageAction } = state;

    // 현재 진행시간 유지
    const currentTime = pageAction.time;

    // reset 하지 않음!!
    rootAction.paused = false;
    pageAction.paused = false;

    // 현재 위치 기준 방향 반전
    rootAction.timeScale = reverse ? -1 : 1;
    pageAction.timeScale = reverse ? -1 : 1;

    // 현재 시간 유지
    rootAction.time = currentTime;
    pageAction.time = currentTime;

    // 끝점 보정
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

  /** 대상 개체를 준비된 empty 개체의 자식으로 배치
   * @param targetObject 변형을 적용하려는 개체
   * @param emptyObject 준비된 empty 개체
   * @returns 변형 적용된 targetObject 반환, 이후 미세 조정을 위해
   */
  function applyEmptyTransform(targetObject: any, emptyObject: any) {
    targetObject.removeFromParent?.();

    emptyObject.add(targetObject);

    targetObject.position.set(0, 0, 0);
    targetObject.quaternion.identity();
    targetObject.scale.set(1, 1, 1);

    return targetObject;
  }

  /** 0~1 linear => 0~1 ease */
  function easeInOutSine(t: number) {
    return -(Math.cos(Math.PI * t) - 1) / 2;
  }

  /** Bounding Box Fitting 카메라 fov 계산 */
  function calcFitFOV() {
    /** blender 에서 미리 측정한 두 개체간 거리 */
    const dist = 2.88446;
    /** 페이지 배율 조정 */
    const ratio = 3500;
    // 세로 기준
    const vFOV = 2 * Math.atan(PageSize.y / ratio / (2 * dist));

    // 가로 기준
    const hFOV = 2 * Math.atan(PageSize.x / ratio / (2 * dist));

    // horizontal -> vertical 변환
    const hFOV_as_vFOV =
      2 * Math.atan(Math.tan(hFOV / 2) / threeContext.camera.aspect);

    // 더 큰 쪽 채택
    const finalFOV = Math.max(vFOV, hFOV_as_vFOV);

    return THREE.MathUtils.radToDeg(finalFOV);
  }

  /** 점진적 카메라 fov 변경 */
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

  /** 페이지 html 버튼 구성 총괄용 */
  let p5canvas: p5;
  /** 표지 보기 애니메이션 동작 여부 */
  let isCoverAnimPlaying = true;
  /** 양식에 맞춰 epub 파일 구성 준비 */
  async function LoadUIButtons() {
    p5canvas?.remove();
    p5canvas = null;
    p5canvas = new p5((p: p5) => {
      p.setup = () => {
        p.noCanvas();
      };
      let rafId = null;
      p.windowResized = () => {
        cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {});
      };
    });
  }

  /** 카메라 앞으로 책 가져오기 */
  function idle_zoom_act() {
    animateFOV(threeContext.camera, calcFitFOV());
    if (AllPages[0].video) {
      const cover = AllPages[0].page.getObjectByName("Plane");
      cover.material.emissive = new THREE.Color(0xffffff);
      cover.material.emissiveMap = VideoTexture;
      cover.material.emissiveIntensity = 0;
      animateEmissive(cover, 1, 1500);
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
    });
    LookCoverStatus = "front";
  }

  /** 앞표지 보기 */
  function MakeThumbnailPageCurrent() {
    // 현재 보고있는 페이지 썸네일화
    const current = CurrentViewPage - 1;
    if (current > 0)
      setTimeout(() => {
        // 현재 보고있는 페이지 썸네일화
        if (!singlePageForm)
          // 단일 페이지 뷰라면 전 페이지 구성하지 않음
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

  /** 뒷표지에서 앞표지 보기 행동 */
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

  /** 하단 컨트롤 버튼 애니메이션 */
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
          margin-right: ${t * 16}px;
          border: ${t * 3}px double var(--threejs-button-border);
          font-size: ${t * 16}px;
        `;
      },
    };
  }

  /** 앞면 보기 */
  function showFrontCover() {
    if (isCoverAnimPlaying) return;
    targetBloom = 0;
    isCoverAnimPlaying = true;
    switch (LookCoverStatus) {
      // 최초 (앞면 보기)
      case "idle":
        idle_zoom_act();
        break;
      // 뒷면 보기
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

  function NextPageBtn() {
    if (isCoverAnimPlaying) return;
    // 아직 책자 확대가 안되어있다면 확대하기
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

  /** 종료 버튼 */
  async function ChooseBtn() {
    if (isCoverAnimPlaying || isRunPageAnimating) return;
    isCoverAnimPlaying = true;
    // 책이 뒤집혀있다면 돌리기
    if (LookCoverStatus == "back")
      await playAnimation(EmptyPageObj, "lookCoverBack", {
        onFinished: () => {
          isCoverAnimPlaying = false;
        },
        reverse: true,
      });
    // 책 접은 후 책 빼기
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
      // 책 덮기
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
    // 리스트에서 다른 책 고르기
  }

  /** 파일을 다운받고 로컬에 기록하기 */
  async function LoadEpubFileAsForm(p: p5, info: BookInfo, file: File) {
    const actId = "loadEpub";
    await p5loading.update({
      id: actId,
      message: "epub 파일 불러오기 (하드코딩)",
    });
    // 페이지 정보 초기화
    PageSize.x = 0;
    PageSize.y = 0;
    if (PagePaths) PagePaths.length = 0;
    PagePaths = null;
    // 파일 정보로부터 epub 분해하기
    const epub = await loadEpub(file);
    PagePaths = getSortedImagePaths(epub);
    // 이미지 경로들로부터 파일을 수집하고 각각 준비된 경로로 저장
    const maxSize = 512;
    /** jpg 퀄리티 */
    const quality = 0.9;
    for (let i = 0, j = PagePaths.length; i < j; i++) {
      if (PageDestroying) {
        p5loading.remove(actId);
        return;
      }
      p5loading.update({
        id: actId,
        message: `epub 파일 불러오기 (하드코딩): ${p.floor((i / j) * 100)}%`,
        progress: i / j,
      });
      const blob = await getImageBlob(epub, PagePaths[i]);
      await indexed.saveBlobToUserPath(blob, PagePaths[i]);
      const FileURL = URL.createObjectURL(blob);
      await new Promise((done: any, err) => {
        p.loadImage(
          FileURL,
          async (v) => {
            // 원본 크기
            const w = v.width;
            const h = v.height;
            // 원본 크기를 기억
            if (!PageSize.x) PageSize.x = v.width;
            if (!PageSize.y) PageSize.y = v.height;
            // 긴 변 기준 스케일 계산
            const scale = Math.min(maxSize / Math.max(w, h), 1);
            // 최종 크기
            const newW = Math.round(w * scale);
            const newH = Math.round(h * scale);
            // resize 적용
            v.resize(newW, newH);
            const blob: Blob = await new Promise((done: any) => {
              v["canvas"].toBlob(
                (getBlob: Blob) => {
                  done(getBlob);
                },
                "image/jpg",
                quality,
              );
            });
            await indexed.saveBlobToUserPath(
              blob,
              `${PagePaths[i]}_thumbnail.jpg`,
            );
            done();
          },
          (e) => {
            console.log("파일 불러오기 실패: ", e);
            err(e);
          },
        );
      });
      URL.revokeObjectURL(FileURL);
    }
    p5loading.update({
      id: actId,
      message: `epub 파일 불러오기 (하드코딩): 100%`,
      progress: 1,
    });
    p5loading.remove(actId);
    await CreatePageObject({
      videoCover: info.video_thumbnail,
    });
    isEPubLoaded = true;
  }

  /** 최초가 아니라서 읽고있던 책이 있었다면 마지막 읽던 위치 정보를 기록하기 */
  function WriteProgressBook() {
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
          // 뒷표지
          toggleMove(threeContext.scene?.getObjectByName("page_center"), true);
          LoadCurrentThumbnail(AllPages[current].page, CurrentViewPage, {
            isEmission: true,
            isFront: false,
            isOriginal: true,
          });
        }
        setTimeout(() => {
          // 지나간 페이지
          if (!AllPages[current].video && current != CurrentViewPage)
            LoadCurrentThumbnail(AllPages[current].page, current, {
              isEmission: true,
              isFront: true,
              isOriginal: false,
            });
        }, 1000);
      } else {
        // 양쪽 페이지
        if (CurrentViewPage == 0) isMoved = true;
        if (CurrentViewPage == AllPages.length - 1) isMoved = false;
        // 움직였다면 왼쪽 보는중
        if (isMoved && CurrentViewPage != 0) {
          toggleMove(threeContext.scene?.getObjectByName("page_center"));
          UserViewPage++;
        } else {
          // 움직이지 않았다면 오른쪽 보는중
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
          // 맨 앞 페이지 열외
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
            // 뒷표지
            LoadCurrentThumbnail(AllPages[current].page, PagePaths.length - 1, {
              isEmission: true,
              isFront: false,
              isOriginal: true,
            });
          }
          // 지나간 페이지
          setTimeout(() => {
            if (current == CurrentViewPage) return;
            // 맨 앞 페이지 열외
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
              // 뒷표지
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
            // 뒷표지
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
        // 양쪽 페이지
        if (CurrentViewPage == 1 || UserViewPage == PagePaths.length - 2)
          isMoved = true;
        // 움직이지 않았다면 오른쪽 보는중
        if (!isMoved && CurrentViewPage != AllPages.length - 1) {
          toggleMove(threeContext.scene?.getObjectByName("page_center"));
          UserViewPage--;
        } else {
          const prev = CurrentViewPage;
          CurrentViewPage--;
          UserViewPage--;
          const current = CurrentViewPage;
          const next = CurrentViewPage - 1;
          // 움직였다면 왼쪽 보는중
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
          // 맨 앞 페이지 열외
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
            // 뒷표지
            LoadCurrentThumbnail(AllPages[next].page, PagePaths.length - 1, {
              isEmission: true,
              isFront: false,
              isOriginal: true,
            });
          }
          // 지나간 페이지
          setTimeout(() => {
            if (prev == CurrentViewPage) return;
            // 맨 앞 페이지 열외
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
              // 뒷표지
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

  /** 책이 마지막 페이지 도달 등으로 왼쪽 페이지에 집중했는지 여부 */
  let isMoved = false;
  let moveAnimation = undefined as {
    object: THREE.Object3D;

    from: THREE.Vector3;
    to: THREE.Vector3;

    duration: number;
    elapsed: number;
  };
  /** 페이지 간 거리 측정 */
  let PageDistance = 0;
  /** 페이지를 옮김 */
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

  /** 두 Object3D 의 월드 원점 기준 거리 반환 */
  function getObjectDistanceData(a: THREE.Object3D, b: THREE.Object3D) {
    a.getWorldPosition(tempVecA);
    b.getWorldPosition(tempVecB);

    const distance = tempVecA.distanceTo(tempVecB);

    const direction = tempDir.subVectors(tempVecB, tempVecA).normalize();

    return {
      distance,
      direction,
    };
  }

  /** 미리 준비된 페이지 정보로 */
  async function CreatePageObject(options?: { videoCover?: string }) {
    AllPages.length = 0;
    // 책의 중심이 배치 위치가 되도록 함
    const pageCenter = threeContext.scene?.getObjectByName("page_center");
    applyEmptyTransform(pageCenter, EmptyPageObj);
    /** 책 등의 중심이지만 책이 넘어가는 애니메이션을 하기 위해 책 페이지 중심도 이것을 씀 */
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
    // 페이지 추가하기
    const PageRoot = threeContext.page?.getObjectByName("PageRoot");
    /** 책 두께에 맞게 계산 */
    const scaleX = PageSize.x / ratio;
    const scaleZ = PageSize.y / ratio;
    // 책 커버 페이지는 앞쪽 단면
    {
      const pageRoot = PageRoot.clone(true);
      const PageObj = pageRoot.getObjectByName("Page");
      PageObj.castShadow = true;
      PageObj.receiveShadow = false;
      // 각 메시에 대해 material과 morphTarget 적용
      PageObj.traverse((obj) => {
        if (obj.isMesh) {
          // material 복제
          obj.material = obj.material.clone();
          obj.geometry.computeBoundingBox();
          // morphTarget 위치 조정
          if (obj.geometry.morphAttributes.position) {
            const morphPositions = obj.geometry.morphAttributes.position;
            morphPositions.forEach((attr) => {
              for (let i = 0; i < attr.count; i++) {
                // 기존 vertex 좌표에 스케일 적용
                attr.setY(i, attr.getY(i) * scaleZ);
              }
            });
            obj.geometry.attributes.position.needsUpdate = true;
          }
        }
      });
      // 스케일 비율 계산
      PageObj.scale.set(scaleX, 1, scaleZ);
      applyEmptyTransform(pageRoot, cover_center);
      try {
        if (!options?.videoCover) throw "비디오 없음";
        await CreateVideoTexTag(PageObj, options.videoCover);
      } catch (e) {
        await LoadCurrentThumbnail(PageObj, 0);
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
    // 책 내용 페이지는 양면
    for (let i = 1, j = PagePaths.length - 2; i < j; i += pageSet) {
      const pageRoot = PageRoot.clone(true);
      const PageObj = pageRoot.getObjectByName("Page");
      PageObj.castShadow = true;
      PageObj.receiveShadow = false;
      // 각 메시에 대해 material과 morphTarget 적용
      PageObj.traverse((obj) => {
        if (obj.isMesh) {
          // material 복제
          obj.material = obj.material.clone();
          obj.geometry.computeBoundingBox();
          // morphTarget 위치 조정
          if (obj.geometry.morphAttributes.position) {
            const morphPositions = obj.geometry.morphAttributes.position;
            morphPositions.forEach((attr) => {
              for (let i = 0; i < attr.count; i++) {
                // 기존 vertex 좌표에 스케일 적용
                attr.setY(i, attr.getY(i) * scaleZ);
              }
            });
            obj.geometry.attributes.position.needsUpdate = true;
          }
        }
      });
      // 스케일 비율 계산
      PageObj.scale.set(scaleX, 1, scaleZ);
      applyEmptyTransform(pageRoot, cover_center);
      await LoadCurrentThumbnail(PageObj, i);
      if (!singlePageForm)
        await LoadCurrentThumbnail(PageObj, i + 1, { isFront: false });

      const offset = (j - 1) / 2 - i;
      pageRoot.position.set(0, offset * PAGE_THICKNESS, 0);
      PageObj.name = `Page_${Math.round(i / 2)}`;
      pageRoot.userData.baseY = pageRoot.position.y;
      AllPages.push({ root: pageRoot, page: PageObj });
    }
    // 책 뒷 커버 페이지는 뒷쪽 단면
    {
      const pageRoot = PageRoot.clone(true);
      const PageObj = pageRoot.getObjectByName("Page");
      PageObj.castShadow = true;
      PageObj.receiveShadow = false;
      // 각 메시에 대해 material과 morphTarget 적용
      PageObj.traverse((obj) => {
        if (obj.isMesh) {
          // material 복제
          obj.material = obj.material.clone();
          obj.geometry.computeBoundingBox();
          // morphTarget 위치 조정
          if (obj.geometry.morphAttributes.position) {
            const morphPositions = obj.geometry.morphAttributes.position;
            morphPositions.forEach((attr) => {
              for (let i = 0; i < attr.count; i++) {
                // 기존 vertex 좌표에 스케일 적용
                attr.setY(i, attr.getY(i) * scaleZ);
              }
            });
            obj.geometry.attributes.position.needsUpdate = true;
          }
        }
      });
      // 스케일 비율 계산
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
      // 등장 애니메이션 재생
    }
    playAnimation(EmptyPageObj, "BookShow", {
      onFinished: () => {
        isCoverAnimPlaying = false;
      },
    });
    await new Promise(requestAnimationFrame);
  }

  /** 순차적 emission 적용 */
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

  /** 페이지 개체에 적합한 썸네일 적용하기 */
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

    let texture: THREE.Texture;

    if (isBlank) {
      // 1x1 white texture 생성
      const data = new Uint8Array([255, 255, 255, 255]);

      texture = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);

      texture.needsUpdate = true;
    } else {
      if (!PagePaths[i]) return;
      const path = isOriginal ? PagePaths[i] : `${PagePaths[i]}_thumbnail.jpg`;

      const blob = await indexed.loadBlobFromUserPath(path, "image/jpg");

      const bitmap = await createImageBitmap(blob);

      texture = new THREE.Texture(bitmap);

      texture.flipY = false;
      texture.needsUpdate = true;
      texture.colorSpace = THREE.SRGBColorSpace;
    }

    const oldTexture = targetObj.material.map;

    if (oldTexture) {
      oldTexture.dispose();
    }

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

  /** 불러온 씬 개체를 제거함, 단독 개체 (obj.clone) 역시 하이라키 구성이기 때문에 이걸로 삭제됨
   *
   * 이 함수 이후에 scene = null 처리
   */
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

      // 완전 제외 (remove도 안 함)
      if (isExcluded(obj)) return;

      // geometry dispose
      if (obj.geometry && !shouldSkipDispose(obj)) {
        obj.geometry.dispose();
      }

      // material dispose
      if (obj.material && !shouldSkipDispose(obj)) {
        const disposeMaterial = (material: any) => {
          for (const key in material) {
            const value = material[key];
            if (value && value.isTexture) {
              value.dispose();
            }
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

    // root 제거 or children 정리
    if (!keepRoot) {
      if (root.parent) {
        root.parent.remove(root);
      }
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

  /** indexedDB 를 전부 탐색하여 삭제함 (DB 초기화) */
  async function ClearIndexedDB() {
    const tree = await indexed.GetFileListFromDB("");
    for (let path of tree) await indexed.removeFileFromUserPath(path);
  }

  /** epub 파일 불러오기 */
  async function loadEpub(file: File) {
    const zip = await JSZip.loadAsync(file);
    return zip;
  }
  /** 파일 경로 검토 */
  function logZipTree(zip: JSZip) {
    Object.keys(zip.files).forEach((path) => {
      const file = zip.files[path];
      console.log(path, file.dir ? "[DIR]" : "[FILE]");
    });
  }
  /** 디버그용, 현재 씬 하이라키 로그 출력 */
  function printHierarchy(root: THREE.Object3D) {
    if (!root) return;

    root.traverse((obj: THREE.Object3D) => {
      const depth = getDepth(obj);
      const indent = "  ".repeat(depth);

      console.log(`${indent}- ${obj.name || obj.type}`);
    });
  }

  // depth 계산 함수
  function getDepth(obj: THREE.Object3D): number {
    let depth = 0;
    let current: THREE.Object3D | null = obj;

    while (current.parent) {
      depth++;
      current = current.parent;
    }

    return depth;
  }
  /** 경로로부터 이미지들만 수집 */
  function getSortedImagePaths(zip: JSZip): string[] {
    return Object.keys(zip.files)
      .filter((path) => {
        return !zip.files[path].dir && /\.(jpg|jpeg|png|webp)$/i.test(path);
      })
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }
  /** zip 에서 경로에 기반하여 blob 추출 */
  async function getImageBlob(zip: JSZip, path: string): Promise<Blob> {
    const file = zip.file(path);
    if (!file) throw new Error(`파일 없음: ${path}`);

    return await file.async("blob");
  }

  /** epub 파일이 전부 불러와지면 페이지 표시 */
  let isEPubLoaded = $state(false);
  /** 파일 불러오기 */
  async function LoadEpubFromURL(info: BookInfo) {
    isEPubLoaded = false;
    LastViewedBookId = info.id;
    const actId = "loadEpub";
    p5loading.update({
      id: actId,
      message: "예시 파일 다운로드 중...",
    });
    try {
      const response = await fetch(info.epub_url);
      if (!response.ok)
        throw new Error(`Failed to fetch file: ${response.statusText}`);

      const contentLength = response.headers.get("Content-Length");
      if (!contentLength) {
        console.warn("Content-Length header is missing, progress unavailable");
      }

      const total = contentLength ? parseInt(contentLength, 10) : 0;
      const reader = response.body.getReader();
      const chunks = [];
      let receivedLength = 0;

      while (true) {
        if (PageDestroying) {
          p5loading.remove(actId);
          return;
        }
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        receivedLength += value.length;

        if (total) {
          const percent = (receivedLength / total) * 100;
          p5loading.update({
            id: actId,
            message: `예시 파일 다운로드 중...: ${Math.floor(percent)}%`,
          });
          // 필요하면 UI 업데이트: progress bar 등
        }
      }

      // 모든 청크를 합쳐 Blob 생성
      const blob = new Blob(chunks);
      const fileName = info.epub_url.split("/").pop() || "download.epub";
      const file = new File([blob], fileName, { type: blob.type });

      // 기존 EPUB 로딩 함수 호출
      LoadEpubFileAsForm(p5canvas, info, file);
    } catch (err) {
      console.error("EPUB 다운로드 실패:", err);
    }
  }

  /** 페이지 번호를 사용자가 눌렀는지 여부 */
  let isPageNumberClicked = $state(false);
  /** 페이지 이동 행동을 반복시키지 않음 */
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
      // 페이지 찾기 행동을 하는 동안 중복 요청 막기
      isRunPageAnimating = true;
      const CurrentPage = UserViewPage || CurrentViewPage;
      const inputValue = document.getElementById("UserInputPage")["value"];
      const userInputPage = inputValue ? Number(inputValue) - 1 : CurrentPage;
      const filtered = Math.min(
        PagePaths.length - 1,
        Math.max(0, userInputPage),
      );
      const diff = filtered - CurrentPage;
      const abs_diff = Math.abs(diff);
      const isPositive = diff > 0;
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

  /** 페이지를 벗어나는 중 */
  let PageDestroying = false;
  onDestroy(() => {
    PageDestroying = true;
    const keys = Object.keys(threeContext);
    for (let key of keys) {
      switch (key) {
        case "container":
          // div 컨테이너는 알아서 삭제될 것입니다
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
    "
>
  <!-- 우측상단 페이지 정보 -->

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
            "
    >
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

  <!-- 하단 버튼들 구성 -->

  <div
    class="center_contents"
    style="
            position: absolute;
            bottom: 0;
            width: 100%;
            height: 150px;
        "
  >
    <div class="center_contents button_panel">
      <!-- UI 버튼 -->

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

      {#if isEPubLoaded && LookCoverStatus != "idle" && UserViewPage != PagePaths?.length - 1}
        <button
          transition:button_anim
          class="button_style"
          onclick={NextPageBtn}>다음</button
        >
      {/if}

      <button
        class="button_style"
        style="margin-right: 0px;"
        onclick={OpenBookList}
      >
        목록
      </button>
    </div>
  </div>
</div>

<!-- dialog modal -->

<dialog bind:this={BookListModal} class="book_modal" class:closing={isClosing}>
  <div class="container">
    <!-- 검색 -->

    <div class="search-bar">
      <input type="text" placeholder="책 제목 / 저자 / 출판사 검색" />

      <button
        style="
                    width: 64px;
                    height: 43px;
                    color: white;
                    cursor: pointer;
                "
        onclick={GoBackHome}
      >
        종료
      </button>
    </div>

    <!-- 필터 -->

    <div class="filters">
      <button class="element-button filter active">전체</button>
      <button class="element-button filter">읽는 중</button>
      <button class="element-button filter">완독</button>
    </div>

    <!-- 리스트 -->

    <div class="list">
      {#each BookList as info}
        <button class="book" onclick={() => ClickBookListFromModal(info)}>
          <img src={info.thumbnail} alt="thumbnail" />

          <div class="info">
            <div class="title">
              {info.title}
            </div>

            <div class="author">
              {info.author}
            </div>

            <div class="status">
              진행률 {info.progress || 0}%
            </div>
          </div>

          {#if LastViewedBookId == info.id && info.progress != 100}
            <div class="badge reading">읽는 중</div>
          {/if}

          {#if info.progress == 100}
            <div class="badge done">완독</div>
          {/if}
        </button>
      {/each}
    </div>
  </div>
</dialog>

<style>
  .button_panel {
    flex-direction: row;
    gap: 0px;

    background-color: #fff8;
    backdrop-filter: blur(2px);

    border-radius: 16px;

    padding: 16px;
  }

  .book_modal {
    padding: 0;

    border: none;

    background: transparent;

    box-shadow: none;

    width: fit-content;
    height: fit-content;

    max-height: 80vh;

    overflow: hidden;

    opacity: 1;
    transform: translateY(0);

    transition:
      opacity 0.25s ease,
      transform 0.25s ease;
  }

  .book_modal::backdrop {
    background: rgba(0, 0, 0, 0.5);
  }

  /* 닫힐 때 */
  .book_modal.closing {
    opacity: 0;
    transform: translateY(40px);
  }
  .book_modal[open] {
    animation: modalShow 0.25s ease;
  }

  @keyframes modalShow {
    from {
      opacity: 0;
      transform: translateY(40px);
    }

    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* 여기부터는 페이지 관련 */
  .center_contents {
    display: flex;
    justify-content: center;
    align-items: center;
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
    margin-right: 16px;
    cursor: pointer;
    padding: 0px;
    font-size: 16px;
  }

  /* 페이지 입력칸에 위아래 숫자 스피너 제거 */

  input[type="number"] {
    -moz-appearance: textfield;
    appearance: textfield;
  }

  input[type="number"]::-webkit-outer-spin-button,
  input[type="number"]::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  /* modal 에서 사용하는 css */

  .container {
    max-width: 900px;
    margin: 0 auto;
    padding: 16px;
  }

  /* 검색 */

  .search-bar {
    display: flex;
    margin-bottom: 12px;
  }

  .search-bar input {
    flex: 1;
    padding: 10px;
    border: 1px solid var(--book-list-filter-border);
    border-radius: 6px;
  }

  .search-bar button {
    margin-left: 12px;
    padding: 10px;
    border: 1px solid var(--book-list-filter-border);
    border-radius: 6px;
    text-align: center;
    background-color: #4444;
  }

  /* 필터 */

  .filters {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
  }

  .filter {
    padding: 6px 12px;
    background: var(--book-list-background);
    border: 1px solid var(--book-list-filter-border);
    border-radius: 20px;
    cursor: pointer;
    font-size: 13px;
  }

  .filter.active {
    background: var(--book-list-filter-bg);
    border-color: var(--book-list-filter-border);
  }

  /* 리스트 */

  .list {
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-height: 60vh;
    overflow-y: auto;
  }

  .book {
    display: flex;
    background: white;
    padding: 12px;
    border-radius: 10px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
    align-items: center;
    gap: 12px;
    cursor: pointer;
  }

  .book img {
    width: 60px;
    height: 90px;
    object-fit: cover;
    border-radius: 6px;
  }

  .info {
    flex: 1;
    text-align: initial;
  }

  .title {
    font-weight: bold;
    margin-bottom: 4px;
    color: black;
  }

  .author {
    font-size: 13px;
    color: #666;
  }

  .status {
    font-size: 12px;
    margin-top: 6px;
    color: #888;
  }

  .badge {
    padding: 4px 8px;
    border-radius: 12px;
    font-size: 12px;
  }

  .badge.reading {
    background: #e6f0ff;
    color: #2b6fff;
  }

  .badge.done {
    background: #e6f7ea;
    color: #1a9c4b;
  }
</style>
