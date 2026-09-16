import{H as w,I as U,K as l,N as y,P as R,V as _,X as F,Y as T,Z as j,_ as C,u as S}from"./chunk-UBTEQ6GO.js";var W=class D extends _{constructor(O,o={}){super(O),this.isReflector=!0,this.type="Reflector",this.camera=new j;let i=this,V=o.color!==void 0?new R(o.color):new R(8355711),A=o.textureWidth||512,k=o.textureHeight||512,z=o.clipBias||0,u=o.shader||D.ReflectorShader,B=o.multisample!==void 0?o.multisample:4,s=new C,n=new l,c=new l,M=new l,d=new y,v=new l(0,0,-1),r=new w,m=new l,b=new l,f=new w,p=new y,t=this.camera,h=new U(A,k,{samples:B,type:S}),g=new T({name:u.name!==void 0?u.name:"unspecified",uniforms:F.clone(u.uniforms),fragmentShader:u.fragmentShader,vertexShader:u.vertexShader});g.uniforms.tDiffuse.value=h.texture,g.uniforms.color.value=V,g.uniforms.textureMatrix.value=p,this.material=g,this.onBeforeRender=function(e,H,x){if(c.setFromMatrixPosition(i.matrixWorld),M.setFromMatrixPosition(x.matrixWorld),d.extractRotation(i.matrixWorld),n.set(0,0,1),n.applyMatrix4(d),m.subVectors(c,M),m.dot(n)>0)return;m.reflect(n).negate(),m.add(c),d.extractRotation(x.matrixWorld),v.set(0,0,-1),v.applyMatrix4(d),v.add(M),b.subVectors(c,v),b.reflect(n).negate(),b.add(c),t.position.copy(m),t.up.set(0,1,0),t.up.applyMatrix4(d),t.up.reflect(n),t.lookAt(b),t.far=x.far,t.updateMatrixWorld(),t.projectionMatrix.copy(x.projectionMatrix),p.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),p.multiply(t.projectionMatrix),p.multiply(t.matrixWorldInverse),p.multiply(i.matrixWorld),s.setFromNormalAndCoplanarPoint(n,c),s.applyMatrix4(t.matrixWorldInverse),r.set(s.normal.x,s.normal.y,s.normal.z,s.constant);let a=t.projectionMatrix;f.x=(Math.sign(r.x)+a.elements[8])/a.elements[0],f.y=(Math.sign(r.y)+a.elements[9])/a.elements[5],f.z=-1,f.w=(1+a.elements[10])/a.elements[14],r.multiplyScalar(2/r.dot(f)),a.elements[2]=r.x,a.elements[6]=r.y,a.elements[10]=r.z+1-z,a.elements[14]=r.w,i.visible=!1;let I=e.getRenderTarget(),q=e.xr.enabled,E=e.shadowMap.autoUpdate;e.xr.enabled=!1,e.shadowMap.autoUpdate=!1,e.setRenderTarget(h),e.state.buffers.depth.setMask(!0),e.autoClear===!1&&e.clear(),e.render(H,t),e.xr.enabled=q,e.shadowMap.autoUpdate=E,e.setRenderTarget(I);let P=x.viewport;P!==void 0&&e.state.viewport(P),i.visible=!0},this.getRenderTarget=function(){return h},this.dispose=function(){h.dispose(),i.material.dispose()}}};W.ReflectorShader={name:"ReflectorShader",uniforms:{color:{value:null},tDiffuse:{value:null},textureMatrix:{value:null}},vertexShader:`
		uniform mat4 textureMatrix;
		varying vec4 vUv;

		#include <common>
		#include <logdepthbuf_pars_vertex>

		void main() {

			vUv = textureMatrix * vec4( position, 1.0 );

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

			#include <logdepthbuf_vertex>

		}`,fragmentShader:`
		uniform vec3 color;
		uniform sampler2D tDiffuse;
		varying vec4 vUv;

		#include <logdepthbuf_pars_fragment>

		float blendOverlay( float base, float blend ) {

			return( base < 0.5 ? ( 2.0 * base * blend ) : ( 1.0 - 2.0 * ( 1.0 - base ) * ( 1.0 - blend ) ) );

		}

		vec3 blendOverlay( vec3 base, vec3 blend ) {

			return vec3( blendOverlay( base.r, blend.r ), blendOverlay( base.g, blend.g ), blendOverlay( base.b, blend.b ) );

		}

		void main() {

			#include <logdepthbuf_fragment>

			vec4 base = texture2DProj( tDiffuse, vUv );
			gl_FragColor = vec4( blendOverlay( base.rgb, color ), 1.0 );

			#include <tonemapping_fragment>
			#include <colorspace_fragment>

		}`};export{W as Reflector};
