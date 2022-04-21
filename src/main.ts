import { ErrorMapper } from "utils/ErrorMapper";
import { v4 as uuid } from "uuid";

declare global {
  /*
    Example types, expand on these or remove them and add your own.
    Note: Values, properties defined here do no fully *exist* by this type definiton alone.
          You must also give them an implemention if you would like to use them. (ex. actually setting a `role` property in a Creeps memory)

    Types added in this `global` block are in an ambient, global context. This is needed because `main.ts` is a module file (uses import or export).
    Interfaces matching on name from @types/screeps will be merged. This is how you can extend the 'built-in' interfaces from @types/screeps.
  */
  // Memory extension samples
  interface Memory {
    uuid: number;
    log: any;
    spawnQueue: Array<SpawnCommand>;
  }

  interface SpawnCommand {
    buildConfig: Array<BodyPartConstant>;
    name: string;
    role: string;
  }

  interface CreepMemory {
    role: string;
    working: boolean;
  }

  // Syntax for adding proprties to `global` (ex "global.log")
  namespace NodeJS {
    interface Global {
      log: any;
    }
  }
}

const SPAWN_CONFIGS = {
  basicWorker: [MOVE, MOVE, CARRY, WORK]
};

const queueBasicWorkers = (count: number) => {
  count = Math.max(0, count);
  let n = 0;
  while (count-- > 0) {
    Memory.spawnQueue.push({ buildConfig: SPAWN_CONFIGS.basicWorker, name: uuid(), role: "basicWorker" });
    n++;
  }
  console.log(`queued ${n} workers.`);
};

const init = () => {
  if (!Memory.spawnQueue) {
    Memory.spawnQueue = [];
  }
};

const spawnErrToMsg = (code: ScreepsReturnCode) => {
  switch (code) {
    case OK:
      return "The operation has been scheduled successfully.";
    case ERR_NOT_OWNER:
      return "You are not the owner of this spawn.";
    case ERR_NAME_EXISTS:
      return "There is a creep with the same name already.";
    case ERR_BUSY:
      return "The spawn is already in process of spawning another creep.";
    case ERR_NOT_ENOUGH_ENERGY:
      return "The spawn and its extensions contain not enough energy to create a creep with the given body.";
    case ERR_INVALID_ARGS:
      return "Body is not properly described or name was not provided.";
    case ERR_RCL_NOT_ENOUGH:
      return "Your Room Controller level is insufficient to use this spawn.";
    default:
      return "Unknown spawn error.";
  }
};

const spawnFromQueue = (room: Room) => {
  const spawns = room.find(FIND_MY_SPAWNS);

  let next: SpawnCommand;
  let res: ScreepsReturnCode;
  for (const s of spawns) {
    if (s.spawning) continue;
    next = Memory.spawnQueue.splice(0, 1)[0];
    console.log(`found spawn ${s.name} not spawning. Spawning ${next} from queue...`);
    if ((res = s.spawnCreep(next.buildConfig, next.name, { memory: { role: next.role, working: false } })) !== 0) {
      console.log(`Failed to spawn creep. Reason:`);
      console.log(spawnErrToMsg(res));
      Memory.spawnQueue.splice(0, 0, next);
    }
  }
};

const BASIC_WORKER_POP = 10;

const maintainBasicWorkers = (room: Room) => {
  const creeps = room.find(FIND_MY_CREEPS);
  const allCreeps = creeps.length + Memory.spawnQueue.length;
  console.log(`all (pending / existing) creeps pop is ${allCreeps}.`);
  if (allCreeps < BASIC_WORKER_POP) {
    const more = BASIC_WORKER_POP - creeps.length;
    console.log(`(spawning) creeps pop smaller than target pop ${BASIC_WORKER_POP}. Queuing ${more}`);
    queueBasicWorkers(more);
  }
};

const commandIdleWorkers = (room: Room) => {
  const idleCreeps = room.find(FIND_MY_CREEPS, {filter: ({memory: {role, working}, store}) => !working && role === 'basic-worker' && store.getFreeCapacity() > 0})
  for (const c of idleCreeps) {
    goHarvestEnergy(room, c)
  }
}

const findNearestSource = (room: Room, position: RoomPosition) => {

}

const goHarvestEnergy = (room: Room, creep: Creep) => {
  const source = creep.pos.findClosestByPath(FIND_SOURCES)
  if (!source) {
    console.warn(`can't find any source to harvest. will continue to idle.`)
    return
  }

  if (creep.harvest(source) !== 0) {
    console.log(`failed to harvest because code ${}`)
  }
  creep.moveTo(source)
};

// When compiling TS to JS and bundling with rollup, the line numbers and file names in error messages change
// This utility uses source maps to get the line numbers and file names of the original, TS source code
export const loop = ErrorMapper.wrapLoop(() => {
  console.log(`Current game tick is ${Game.time}`);

  init();

  const room = Game.rooms.sim;

  maintainBasicWorkers(room);

  spawnFromQueue(room);

  // Automatically delete memory of missing creeps
  for (const name in Memory.creeps) {
    if (!(name in Game.creeps)) {
      delete Memory.creeps[name];
    }
  }
});
