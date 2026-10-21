import * as CANNON from 'cannon-es';

const AIR_TORQUE_PER_KG = 2.4;
const MAX_AIR_ANGVEL = 7;

/**
 * Wraps a cannon-es RaycastVehicle with the tuning + air-control behavior
 * this game needs. Wheel order is fixed: 0=FL, 1=FR, 2=RL, 3=RR.
 */
export class Vehicle {
  constructor(world, carDef, spawnPos, spawnYaw = 0) {
    this.def = carDef;
    this.world = world;

    const { w, h, l } = carDef.dims;
    const chassisShape = new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, l / 2));
    const chassisBody = new CANNON.Body({ mass: carDef.mass });
    chassisBody.addShape(chassisShape);
    chassisBody.position.set(spawnPos.x, spawnPos.y, spawnPos.z);
    chassisBody.quaternion.setFromEuler(0, spawnYaw, 0, 'YXZ');
    chassisBody.angularDamping = 0.5;
    chassisBody.linearDamping = 0.012;
    this.chassisBody = chassisBody;

    const vehicle = new CANNON.RaycastVehicle({
      chassisBody,
      indexRightAxis: 0,
      indexUpAxis: 1,
      indexForwardAxis: 2,
    });

    const wheelOptions = {
      radius: carDef.wheelRadius,
      directionLocal: new CANNON.Vec3(0, -1, 0),
      suspensionStiffness: 36,
      suspensionRestLength: 0.32,
      frictionSlip: carDef.frictionSlip,
      dampingRelaxation: 2.5,
      dampingCompression: 4.6,
      maxSuspensionForce: 200000,
      rollInfluence: carDef.rollInfluence,
      axleLocal: new CANNON.Vec3(-1, 0, 0),
      chassisConnectionPointLocal: new CANNON.Vec3(),
      maxSuspensionTravel: 0.22,
      customSlidingRotationalSpeed: -40,
      useCustomSlidingRotationalSpeed: true,
    };

    const axleX = w / 2 - 0.12;
    const axleFrontZ = l / 2 - carDef.wheelRadius * 1.6;
    const axleRearZ = -l / 2 + carDef.wheelRadius * 1.6;
    const axleY = -h / 2 + 0.1;
    const connections = [
      [-axleX, axleY, axleFrontZ],
      [axleX, axleY, axleFrontZ],
      [-axleX, axleY, axleRearZ],
      [axleX, axleY, axleRearZ],
    ];
    this._baseFrictionSlip = carDef.frictionSlip;

    for (const [x, y, z] of connections) {
      const opt = { ...wheelOptions, chassisConnectionPointLocal: new CANNON.Vec3(x, y, z) };
      vehicle.addWheel(opt);
    }

    vehicle.addToWorld(world);
    this.vehicle = vehicle;
    this._safePos = chassisBody.position.clone();
    this._safeYaw = spawnYaw;
    this._stuckTimer = 0;
  }

  get groundedWheelCount() {
    return this.vehicle.wheelInfos.filter((w) => w.raycastResult.hasHit).length;
  }

  get isAirborne() {
    return this.groundedWheelCount === 0;
  }

  /** Current steering angle as a -1..1 ratio of this car's max steer — used to pose the driver's hands. */
  get steerRatio() {
    return this.vehicle.wheelInfos[0].steering / this.def.maxSteer;
  }

  update(dt, input) {
    const def = this.def;
    const body = this.chassisBody;
    const throttle = input.isDown('throttle');
    const brake = input.isDown('brake');
    const left = input.isDown('left');
    const right = input.isDown('right');
    const handbrake = input.isDown('handbrake');

    const worldForward = body.quaternion.vmult(new CANNON.Vec3(0, 0, 1));
    const speedAlongForward = body.velocity.dot(worldForward);

    let engineForce = 0;
    let brakeForce = 0;

    if (throttle && !brake) {
      engineForce = -def.engineForce;
    } else if (brake && !throttle) {
      if (speedAlongForward > 0.6) {
        brakeForce = def.brakeForce * 45;
      } else {
        engineForce = def.engineForce * 0.55;
      }
    }

    const grounded = !this.isAirborne;
    const steer = (right ? 1 : 0) - (left ? 1 : 0);
    const steerVal = grounded ? -steer * def.maxSteer : 0;
    this.vehicle.setSteeringValue(steerVal, 0);
    this.vehicle.setSteeringValue(steerVal, 1);

    this.vehicle.applyEngineForce(engineForce, 2);
    this.vehicle.applyEngineForce(engineForce, 3);
    if (def.drivetrain === 'awd') {
      this.vehicle.applyEngineForce(engineForce * 0.6, 0);
      this.vehicle.applyEngineForce(engineForce * 0.6, 1);
    }

    for (let i = 0; i < 4; i++) this.vehicle.setBrake(brakeForce, i);

    if (handbrake && grounded) {
      // Breaking rear grip is what starts the slide; hard-locking the rears
      // too is only for a stationary handbrake turn — with throttle also
      // held it would just fight the engine and stall the power-slide.
      if (!throttle) {
        this.vehicle.setBrake(def.brakeForce * 90, 2);
        this.vehicle.setBrake(def.brakeForce * 90, 3);
      }
      this.vehicle.wheelInfos[2].frictionSlip = this._baseFrictionSlip * 0.3;
      this.vehicle.wheelInfos[3].frictionSlip = this._baseFrictionSlip * 0.3;
    } else {
      this.vehicle.wheelInfos[2].frictionSlip = this._baseFrictionSlip;
      this.vehicle.wheelInfos[3].frictionSlip = this._baseFrictionSlip;
    }

    if (this.isAirborne) {
      const pitchInput = (brake ? 1 : 0) - (throttle ? 1 : 0);
      const rollInput = (right ? 1 : 0) - (left ? 1 : 0);
      if (pitchInput !== 0 || rollInput !== 0) {
        const torqueMag = def.mass * AIR_TORQUE_PER_KG;
        const localTorque = new CANNON.Vec3(pitchInput * torqueMag, 0, rollInput * torqueMag * -1);
        const worldTorque = body.quaternion.vmult(localTorque);
        body.torque.x += worldTorque.x;
        body.torque.y += worldTorque.y;
        body.torque.z += worldTorque.z;
      }
      body.angularVelocity.scale(0.99, body.angularVelocity);
      const av = body.angularVelocity;
      const mag = av.length();
      if (mag > MAX_AIR_ANGVEL) av.scale(MAX_AIR_ANGVEL / mag, av);
    } else {
      this._safePos.copy(body.position);
      const e = new CANNON.Vec3();
      body.quaternion.toEuler(e); // cannon-es only implements the default 'YZX' decomposition; e.y is yaw
      this._safeYaw = e.y;
      this._stuckTimer = speedAlongForward > 0.5 || speedAlongForward < -0.5 ? 0 : this._stuckTimer + dt;
    }
  }

  resetUpright() {
    const body = this.chassisBody;
    body.position.set(this._safePos.x, this._safePos.y + 1.4, this._safePos.z);
    body.velocity.set(0, 0, 0);
    body.angularVelocity.set(0, 0, 0);
    body.quaternion.setFromEuler(0, this._safeYaw, 0, 'YXZ');
    body.torque.set(0, 0, 0);
    body.force.set(0, 0, 0);
    this._stuckTimer = 0;
  }

  get isStuck() {
    return this._stuckTimer > 2.2;
  }

  getTelemetry() {
    const def = this.def;
    const speedMs = this.chassisBody.velocity.length();
    const topSpeedMs = def.topSpeedKmh / 3.6;
    const speedRatio = Math.min(1, speedMs / topSpeedMs);
    const throttleDown = this.vehicle.currentVehicleSpeedKmHour !== undefined;
    const worldRight = this.chassisBody.quaternion.vmult(new CANNON.Vec3(1, 0, 0));
    const lateralSpeed = Math.abs(this.chassisBody.velocity.dot(worldRight));
    const slip = Math.min(1, lateralSpeed / 7);
    const gear = Math.max(1, Math.min(6, 1 + Math.floor(speedRatio * 6)));
    return {
      speedMs,
      speedKmh: speedMs * 3.6,
      speedMph: speedMs * 2.23694,
      speedRatio,
      slip,
      gear,
      grounded: !this.isAirborne,
      groundedWheelCount: this.groundedWheelCount,
    };
  }
}
