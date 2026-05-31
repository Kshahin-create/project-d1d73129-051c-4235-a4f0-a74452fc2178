-- Import units and tenants from user's Excel sheet
DELETE FROM tenant_account_units WHERE unit_id IN (SELECT id FROM units WHERE building_number BETWEEN 1 AND 10);
DELETE FROM tenants WHERE unit_id IN (SELECT id FROM units WHERE building_number BETWEEN 1 AND 10);

UPDATE units SET status='reserved', price=65000, area=130, unit_type='ركنية', activity='مراكز صيانة سيارات', updated_at=now() WHERE building_number=1 AND unit_number=399;
UPDATE units SET status='reserved', price=60060, area=132, unit_type='داخلية', activity='مراكز صيانة سيارات', updated_at=now() WHERE building_number=1 AND unit_number=400;
UPDATE units SET status='reserved', price=60060, area=132, unit_type='داخلية', activity='مراكز صيانة سيارات', updated_at=now() WHERE building_number=1 AND unit_number=401;
UPDATE units SET status='reserved', price=60060, area=132, unit_type='داخلية', activity='مراكز صيانة سيارات', updated_at=now() WHERE building_number=1 AND unit_number=402;
UPDATE units SET status='available', price=60060, area=132, unit_type='داخلية', activity='مراكز صيانة سيارات', updated_at=now() WHERE building_number=1 AND unit_number=403;
UPDATE units SET status='available', price=60060, area=132, unit_type='داخلية', activity='مراكز صيانة سيارات', updated_at=now() WHERE building_number=1 AND unit_number=404;
UPDATE units SET status='available', price=60060, area=132, unit_type='داخلية', activity='مراكز صيانة سيارات', updated_at=now() WHERE building_number=1 AND unit_number=405;
UPDATE units SET status='available', price=60060, area=132, unit_type='داخلية', activity='مراكز صيانة سيارات', updated_at=now() WHERE building_number=1 AND unit_number=406;
UPDATE units SET status='available', price=60060, area=132, unit_type='داخلية', activity='مراكز صيانة سيارات', updated_at=now() WHERE building_number=1 AND unit_number=407;
UPDATE units SET status='available', price=60060, area=132, unit_type='داخلية', activity='مراكز صيانة سيارات', updated_at=now() WHERE building_number=1 AND unit_number=408;
UPDATE units SET status='available', price=60060, area=132, unit_type='داخلية', activity='مراكز صيانة سيارات', updated_at=now() WHERE building_number=1 AND unit_number=409;
UPDATE units SET status='reserved', price=65000, area=130, unit_type='ركنية', activity='مراكز صيانة سيارات', updated_at=now() WHERE building_number=1 AND unit_number=410;
UPDATE units SET status='reserved', price=65000, area=130, unit_type='ركنية', activity='مراكز صيانة سيارات', updated_at=now() WHERE building_number=1 AND unit_number=411;
UPDATE units SET status='reserved', price=60060, area=132, unit_type='داخلية', activity='مراكز صيانة سيارات', updated_at=now() WHERE building_number=1 AND unit_number=412;
UPDATE units SET status='reserved', price=60060, area=132, unit_type='داخلية', activity='مراكز صيانة سيارات', updated_at=now() WHERE building_number=1 AND unit_number=413;
UPDATE units SET status='reserved', price=60060, area=132, unit_type='داخلية', activity='مراكز صيانة سيارات', updated_at=now() WHERE building_number=1 AND unit_number=414;
UPDATE units SET status='available', price=60060, area=132, unit_type='داخلية', activity='مراكز صيانة سيارات', updated_at=now() WHERE building_number=1 AND unit_number=415;
UPDATE units SET status='available', price=60060, area=132, unit_type='داخلية', activity='مراكز صيانة سيارات', updated_at=now() WHERE building_number=1 AND unit_number=416;
UPDATE units SET status='available', price=60060, area=132, unit_type='داخلية', activity='مراكز صيانة سيارات', updated_at=now() WHERE building_number=1 AND unit_number=417;
UPDATE units SET status='available', price=60060, area=132, unit_type='داخلية', activity='مراكز صيانة سيارات', updated_at=now() WHERE building_number=1 AND unit_number=418;
UPDATE units SET status='available', price=60060, area=132, unit_type='داخلية', activity='مراكز صيانة سيارات', updated_at=now() WHERE building_number=1 AND unit_number=419;
UPDATE units SET status='available', price=60060, area=132, unit_type='داخلية', activity='مراكز صيانة سيارات', updated_at=now() WHERE building_number=1 AND unit_number=420;
UPDATE units SET status='available', price=60060, area=132, unit_type='داخلية', activity='مراكز صيانة سيارات', updated_at=now() WHERE building_number=1 AND unit_number=421;
UPDATE units SET status='reserved', price=65000, area=130, unit_type='ركنية', activity='مراكز صيانة سيارات', updated_at=now() WHERE building_number=1 AND unit_number=422;