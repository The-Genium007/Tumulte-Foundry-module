/**
 * TumulteGlowFilter -- Embedded glow filter for monster token halos.
 *
 * Adapted from pixi-filters GlowFilter (MIT License, by mishaa).
 * Original: https://github.com/pixijs/filters/tree/main/src/glow
 *
 * This is a self-contained version compatible with PIXI v5/v7 (Foundry VTT v11-v13).
 * Automatically detects the PixiJS/WebGL version and uses the appropriate GLSL syntax.
 * No external dependency required.
 */

interface CanvasApp {
  renderer?: RendererWithContext
}

interface RendererWithContext {
  context?: {
    webGLVersion?: number
    gl?: unknown
  }
  gl?: unknown
}

interface GlowFilterOptions {
  distance?: number
  outerStrength?: number
  innerStrength?: number
  color?: number
  alpha?: number
  quality?: number
  knockout?: boolean
}

/**
 * Detect whether we need GLSL 300 ES syntax.
 * Foundry v12+ uses PixiJS v7 which creates a WebGL2 context by default.
 * In WebGL2, GLSL 300 ES is preferred for reliability across GPU drivers.
 */
function isWebGL2Context(): boolean {
  try {
    const canvasRef = canvas as (Canvas & { app?: CanvasApp }) | undefined
    const renderer = canvasRef?.app?.renderer
    if (!renderer) return false
    // PixiJS v7 renderer.context.webGLVersion === 2
    if (renderer.context?.webGLVersion === 2) return true
    // Fallback: check gl instance
    const gl = renderer.gl ?? renderer.context?.gl
    if (gl instanceof WebGL2RenderingContext) return true
    return false
  } catch {
    return false
  }
}

// -- GLSL 100 (WebGL1 / PixiJS v5 / Foundry v11) --

const vertexShaderGL1: string = `
attribute vec2 aVertexPosition;
attribute vec2 aTextureCoord;

uniform mat3 projectionMatrix;

varying vec2 vTextureCoord;

void main(void) {
    gl_Position = vec4((projectionMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);
    vTextureCoord = aTextureCoord;
}
`

function buildFragmentShaderGL1(distance: number, quality: number): string {
  const angleStepSize = Math.min((1 / quality / distance), Math.PI * 2).toFixed(7)
  const dist = distance.toFixed(0) + '.0'

  return `
varying vec2 vTextureCoord;

uniform sampler2D uSampler;
uniform vec4 filterArea;
uniform vec4 filterClamp;

uniform vec2 uStrength;
uniform vec3 uColor;
uniform float uKnockout;
uniform float uAlpha;

const float PI = 3.14159265358979323846264;
const float DIST = ${dist};
const float ANGLE_STEP_SIZE = min(${angleStepSize}, PI * 2.);
const float ANGLE_STEP_NUM = ceil(PI * 2. / ANGLE_STEP_SIZE);
const float MAX_TOTAL_ALPHA = ANGLE_STEP_NUM * DIST * (DIST + 1.) / 2.;

void main(void) {
    vec2 px = vec2(1.0) / filterArea.xy;

    float totalAlpha = 0.0;
    vec2 direction;
    vec2 displaced;
    vec4 curColor;

    for (float angle = 0.0; angle < PI * 2.0; angle += ANGLE_STEP_SIZE) {
        direction = vec2(cos(angle), sin(angle)) * px;
        for (float curDistance = 0.0; curDistance < DIST; curDistance++) {
            displaced = clamp(vTextureCoord + direction * (curDistance + 1.0), filterClamp.xy, filterClamp.zw);
            curColor = texture2D(uSampler, displaced);
            totalAlpha += (DIST - curDistance) * curColor.a;
        }
    }

    curColor = texture2D(uSampler, vTextureCoord);

    vec4 glowColor = vec4(uColor, uAlpha);
    bool knockout = uKnockout > 0.5;
    float innerStrength = uStrength.x;
    float outerStrength = uStrength.y;

    float alphaRatio = totalAlpha / MAX_TOTAL_ALPHA;
    float innerGlowAlpha = (1.0 - alphaRatio) * innerStrength * curColor.a * uAlpha;
    float innerGlowStrength = min(1.0, innerGlowAlpha);

    vec4 innerColor = mix(curColor, glowColor, innerGlowStrength);
    float outerGlowAlpha = alphaRatio * outerStrength * (1.0 - curColor.a) * uAlpha;
    float outerGlowStrength = min(1.0 - innerColor.a, outerGlowAlpha);
    vec4 outerGlowColor = outerGlowStrength * glowColor.rgba;

    if (knockout) {
        float resultAlpha = outerGlowAlpha + innerGlowAlpha;
        gl_FragColor = vec4(glowColor.rgb * resultAlpha, resultAlpha);
    } else {
        gl_FragColor = innerColor + outerGlowColor;
    }
}
`
}

// -- GLSL 300 ES (WebGL2 / PixiJS v7 / Foundry v12-v13) --

const vertexShaderGL2: string = `#version 300 es
precision highp float;

in vec2 aVertexPosition;
in vec2 aTextureCoord;

uniform mat3 projectionMatrix;

out vec2 vTextureCoord;

void main(void) {
    gl_Position = vec4((projectionMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);
    vTextureCoord = aTextureCoord;
}
`

function buildFragmentShaderGL2(distance: number, quality: number): string {
  const angleStepSize = Math.min((1 / quality / distance), Math.PI * 2).toFixed(7)
  const dist = distance.toFixed(0) + '.0'

  return `#version 300 es
precision mediump float;

in vec2 vTextureCoord;

uniform sampler2D uSampler;
uniform vec4 filterArea;
uniform vec4 filterClamp;

uniform vec2 uStrength;
uniform vec3 uColor;
uniform float uKnockout;
uniform float uAlpha;

out vec4 fragColor;

const float PI = 3.14159265358979323846264;
const float DIST = ${dist};
const float ANGLE_STEP_SIZE = min(${angleStepSize}, PI * 2.);
const float ANGLE_STEP_NUM = ceil(PI * 2. / ANGLE_STEP_SIZE);
const float MAX_TOTAL_ALPHA = ANGLE_STEP_NUM * DIST * (DIST + 1.) / 2.;

void main(void) {
    vec2 px = vec2(1.0) / filterArea.xy;

    float totalAlpha = 0.0;
    vec2 direction;
    vec2 displaced;
    vec4 curColor;

    for (float angle = 0.0; angle < PI * 2.0; angle += ANGLE_STEP_SIZE) {
        direction = vec2(cos(angle), sin(angle)) * px;
        for (float curDistance = 0.0; curDistance < DIST; curDistance++) {
            displaced = clamp(vTextureCoord + direction * (curDistance + 1.0), filterClamp.xy, filterClamp.zw);
            curColor = texture(uSampler, displaced);
            totalAlpha += (DIST - curDistance) * curColor.a;
        }
    }

    curColor = texture(uSampler, vTextureCoord);

    vec4 glowColor = vec4(uColor, uAlpha);
    bool knockout = uKnockout > 0.5;
    float innerStrength = uStrength.x;
    float outerStrength = uStrength.y;

    float alphaRatio = totalAlpha / MAX_TOTAL_ALPHA;
    float innerGlowAlpha = (1.0 - alphaRatio) * innerStrength * curColor.a * uAlpha;
    float innerGlowStrength = min(1.0, innerGlowAlpha);

    vec4 innerColor = mix(curColor, glowColor, innerGlowStrength);
    float outerGlowAlpha = alphaRatio * outerStrength * (1.0 - curColor.a) * uAlpha;
    float outerGlowStrength = min(1.0 - innerColor.a, outerGlowAlpha);
    vec4 outerGlowColor = outerGlowStrength * glowColor.rgba;

    if (knockout) {
        float resultAlpha = outerGlowAlpha + innerGlowAlpha;
        fragColor = vec4(glowColor.rgb * resultAlpha, resultAlpha);
    } else {
        fragColor = innerColor + outerGlowColor;
    }
}
`
}

// -- Filter Class --

export class TumulteGlowFilter extends PIXI.Filter {
  private _colorHex: number

  constructor(options: GlowFilterOptions = {}) {
    const distance = options.distance ?? 10
    const quality = options.quality ?? 0.3
    const color = options.color ?? 0xFFFFFF
    const outerStrength = options.outerStrength ?? 3
    const innerStrength = options.innerStrength ?? 0.5
    const alpha = options.alpha ?? 1
    const knockout = options.knockout ?? false

    const useGL2 = isWebGL2Context()
    const vertex = useGL2 ? vertexShaderGL2 : vertexShaderGL1
    const fragment = useGL2
      ? buildFragmentShaderGL2(distance, quality)
      : buildFragmentShaderGL1(distance, quality)

    super(
      vertex,
      fragment,
      {
        uStrength: new Float32Array([innerStrength, outerStrength]),
        uColor: new Float32Array(3),
        uAlpha: alpha,
        uKnockout: knockout ? 1 : 0,
      }
    )

    this._colorHex = 0
    this.padding = distance

    // Set color
    this.color = color
  }

  /**
   * The color of the glow as a hex integer (e.g. 0x10B981)
   */
  get color(): number {
    return this._colorHex
  }

  set color(value: number) {
    this._colorHex = value
    const r = ((value >> 16) & 0xFF) / 255
    const g = ((value >> 8) & 0xFF) / 255
    const b = (value & 0xFF) / 255
    const uColor = this.uniforms.uColor as Float32Array
    uColor[0] = r
    uColor[1] = g
    uColor[2] = b
  }

  get outerStrength(): number {
    const uStrength = this.uniforms.uStrength as Float32Array
    return uStrength[1] as number
  }

  set outerStrength(value: number) {
    const uStrength = this.uniforms.uStrength as Float32Array
    uStrength[1] = value
  }

  get innerStrength(): number {
    const uStrength = this.uniforms.uStrength as Float32Array
    return uStrength[0] as number
  }

  set innerStrength(value: number) {
    const uStrength = this.uniforms.uStrength as Float32Array
    uStrength[0] = value
  }

  get alpha(): number {
    return this.uniforms.uAlpha as number
  }

  set alpha(value: number) {
    this.uniforms.uAlpha = value
  }
}

export default TumulteGlowFilter
