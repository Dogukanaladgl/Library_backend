import {
  EventSubscriber,
  EntitySubscriberInterface,
  InsertEvent,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

@EventSubscriber()
export class UuidSubscriber implements EntitySubscriberInterface {
  beforeInsert(event: InsertEvent<any>) {
    const entity = event.entity as { id?: string } | undefined;
    if (!entity) return;
    const idColumn = event.metadata.primaryColumns.find(
      (c) => c.propertyName === 'id' && c.type === 'uuid',
    );
    if (idColumn && !entity.id) {
      entity.id = uuidv4();
    }
  }
}
